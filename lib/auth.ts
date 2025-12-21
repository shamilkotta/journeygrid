import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, genericOAuth } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "./db";
import {
  accounts,
  journeys,
  sessions,
  users,
  verifications,
} from "./db/schema";
import { nextCookies } from "better-auth/next-js";

// Construct schema object for drizzle adapter
const schema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  journeys,
};

// Initialize Resend for email
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Determine the base URL for authentication
// This supports Vercel Preview deployments with dynamic URLs
function getBaseURL() {
  // Priority 1: Explicit BETTER_AUTH_URL (set manually for production/dev)
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  // Priority 2: NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Priority 3: Check if we're on Vercel (for preview deployments)
  if (process.env.VERCEL_URL) {
    // VERCEL_URL doesn't include protocol, so add it
    // Use https for Vercel deployments (both production and preview)
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback: Local development
  return "http://localhost:3000";
}

// Build plugins array conditionally
const plugins = [
  anonymous({
    async onLinkAccount(data) {
      // When an anonymous user links to a real account, migrate their data
      const fromUserId = data.anonymousUser.user.id;
      const toUserId = data.newUser.user.id;

      console.log(
        `[Anonymous Migration] Migrating from user ${fromUserId} to ${toUserId}`
      );

      try {
        // Migrate journeys
        await db
          .update(journeys)
          .set({ userId: toUserId })
          .where(eq(journeys.userId, fromUserId));

        console.log(
          `[Anonymous Migration] Successfully migrated data from ${fromUserId} to ${toUserId}`
        );
      } catch (error) {
        console.error(
          "[Anonymous Migration] Error migrating user data:",
          error
        );
        throw error;
      }
    },
  }),
  // ...(process.env.VERCEL_CLIENT_ID
  //   ? [
  //       genericOAuth({
  //         config: [
  //           {
  //             providerId: "vercel",
  //             clientId: process.env.VERCEL_CLIENT_ID,
  //             clientSecret: process.env.VERCEL_CLIENT_SECRET || "",
  //             authorizationUrl: "https://vercel.com/oauth/authorize",
  //             tokenUrl: "https://api.vercel.com/login/oauth/token",
  //             userInfoUrl: "https://api.vercel.com/login/oauth/userinfo",
  //             scopes: ["openid", "email", "profile"],
  //             discoveryUrl: undefined,
  //             pkce: true,
  //             getUserInfo: async (tokens) => {
  //               const response = await fetch(
  //                 "https://api.vercel.com/login/oauth/userinfo",
  //                 {
  //                   headers: {
  //                     Authorization: `Bearer ${tokens.accessToken}`,
  //                   },
  //                 }
  //               );
  //               const profile = await response.json();
  //               console.log("[Vercel OAuth] userinfo response:", profile);
  //               return {
  //                 id: profile.sub,
  //                 email: profile.email,
  //                 name: profile.name ?? profile.preferred_username,
  //                 emailVerified: profile.email_verified ?? true,
  //                 image: profile.picture,
  //               };
  //             },
  //           },
  //         ],
  //       }),
  //     ]
  //   : []),
  nextCookies(),
];

export const auth = betterAuth({
  baseURL: getBaseURL(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: !!resend,
    sendResetPassword: resend
      ? async ({ user, url }) => {
          await resend.emails.send({
            from:
              process.env.EMAIL_FROM || "journeygrid <noreply@journeygrid.com>",
            to: user.email,
            subject: "Reset your password",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #111;">Reset your password</h1>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.5;">
                  Hi${user.name ? ` ${user.name}` : ""},
                </p>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.5;">
                  You requested to reset your password. Click the button below to create a new password:
                </p>
                <a href="${url}" style="display: inline-block; background-color: #000; color: #fff; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">
                  Reset Password
                </a>
                <p style="font-size: 14px; color: #6b7280; margin-top: 24px; line-height: 1.5;">
                  If you didn't request this, you can safely ignore this email.
                </p>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                  This link will expire in 1 hour.
                </p>
              </div>
            `,
          });
        }
      : undefined,
  },
  emailVerification: resend
    ? {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await resend.emails.send({
            from:
              process.env.EMAIL_FROM || "journeygrid <noreply@journeygrid.com>",
            to: user.email,
            subject: "Verify your email address",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #111;">Verify your email</h1>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.5;">
                  Hi${user.name ? ` ${user.name}` : ""},
                </p>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.5;">
                  Thanks for signing up! Please verify your email address by clicking the button below:
                </p>
                <a href="${url}" style="display: inline-block; background-color: #000; color: #fff; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">
                  Verify Email
                </a>
                <p style="font-size: 14px; color: #6b7280; margin-top: 24px; line-height: 1.5;">
                  If you didn't create an account, you can safely ignore this email.
                </p>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                  This link will expire in 24 hours.
                </p>
              </div>
            `,
          });
        },
      }
    : undefined,
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID || "",
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  //     enabled: !!process.env.GITHUB_CLIENT_ID,
  //   },
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID || "",
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  //     enabled: !!process.env.GOOGLE_CLIENT_ID,
  //   },
  // },
  plugins,
});
