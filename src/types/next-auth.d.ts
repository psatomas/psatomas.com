/**
 * Extends next-auth's built-in Session/JWT shapes with the one extra
 * field the authorization check needs: whether Google itself verified
 * the email on the token. Standard next-auth module-augmentation pattern
 * — see https://authjs.dev/getting-started/typescript for the convention
 * this follows.
 */
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    emailVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    emailVerified?: boolean;
  }
}
