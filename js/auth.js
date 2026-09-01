/**
 * auth.js
 * Demo authentication for Version 1.
 *
 * There is no real password check here on purpose — this is a
 * two-person prototype, not a production login. When Firebase
 * Authentication is added, replace the body of login()/logout()
 * with real calls and keep the same function names so app.js and
 * router.js don't need to change.
 */

const Auth = (() => {
  const DEMO_USERNAMES = {
    tony: CONFIG.users.tony.id,
    babegirl: CONFIG.users.babegirl.id,
  };

  function normalise(name) {
    return (name || "").trim().toLowerCase();
  }

  function login(username) {
    const key = normalise(username);
    const userId = DEMO_USERNAMES[key];
    if (!userId) {
      return { success: false, error: "We don't recognise that name. Try \u201CTony\u201D or \u201CBabegirl\u201D." };
    }
    Storage.setSession(userId);
    return { success: true, userId };
  }

  function logout() {
    Storage.clearSession();
  }

  function currentUser() {
    const session = Storage.getSession();
    if (!session || !CONFIG.users[session.userId]) return null;
    return CONFIG.users[session.userId];
  }

  function otherUser() {
    const me = currentUser();
    if (!me) return null;
    const otherId = me.id === CONFIG.users.tony.id ? CONFIG.users.babegirl.id : CONFIG.users.tony.id;
    return CONFIG.users[otherId];
  }

  function isAuthenticated() {
    return currentUser() !== null;
  }

  return { login, logout, currentUser, otherUser, isAuthenticated };
})();
