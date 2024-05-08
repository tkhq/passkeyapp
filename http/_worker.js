// Adds the proper MIME type to serve apple-app-site-association file
export default {
  async fetch(request, env) {
    // Fetch the asset
    const response = await env.ASSETS.fetch(request);

    // Response is immutable by default. Fix this.
    const responseClone = new Response(response.body, response);

    // Force application/json for apple-app-site-association file
    const url = new URL(request.url);
    if (url.pathname.endsWith("apple-app-site-association")) {
      responseClone.headers.set("Content-Type", "application/json");
    }

    // Return our response!
    return responseClone;
  },
};
