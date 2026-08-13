interface AccountIdentity {
  username?: string | null;
  email?: string | null;
  role?: string | null;
}

const LUCAS_USERNAME = "llucaspaim";
const LUCAS_EMAIL = "lucas.mendonca@metropoles.com";

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function isLucasAccount(user?: AccountIdentity | null) {
  return (
    user?.role === "ADMIN" &&
    normalize(user.username) === LUCAS_USERNAME &&
    normalize(user.email) === LUCAS_EMAIL
  );
}
