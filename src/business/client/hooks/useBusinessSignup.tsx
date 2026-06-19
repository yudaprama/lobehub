export interface BusinessSignupFomData {
  email?: string;
  password?: string;
  username?: string;
}

export const useBusinessSignup = (form: any) => {
  return {
    businessElement: null,
    getCaptchaTokenOnError: async (_error: unknown) => undefined as string | null | undefined,
    getFetchOptions: async () => {
      return {};
    },
    preSocialSignupCheck: async (_values: BusinessSignupFomData) => {
      return true;
    },
  };
};
