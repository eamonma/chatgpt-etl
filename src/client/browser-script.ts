function minify(js: string): string {
  return js
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s{2,}/g, " ");
}

export function generateBrowserScript(port: number, { compact = false }: { compact?: boolean } = {}): string {
  const script = `(function() {
  var accessToken = null;

  function getToken() {
    return fetch("https://chatgpt.com/api/auth/session", { credentials: "include" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        accessToken = data.accessToken;
        console.log("[chatgpt-etl] Got access token: " + accessToken.substring(0, 20) + "...");
        return accessToken;
      });
  }

  getToken().then(function() {
    var ws = new WebSocket("ws://localhost:${port}");

    ws.addEventListener("open", function() {
      console.log("[chatgpt-etl] Connected to bridge on port ${port}");
    });

    ws.addEventListener("message", function(event) {
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error("[chatgpt-etl] Failed to parse message:", e);
        return;
      }

      var id = msg.id;
      var request = msg.request;
      var headers = Object.assign({}, request.headers);
      if (accessToken && !headers["Authorization"]) {
        headers["Authorization"] = "Bearer " + accessToken;
      }

      var fetchOpts = {
        method: request.method,
        headers: headers,
        credentials: "include"
      };
      if (request.body) {
        fetchOpts.body = request.body;
      }

      fetch(request.url, fetchOpts)
      .then(function(response) {
        var respHeaders = {};
        response.headers.forEach(function(value, key) {
          respHeaders[key] = value;
        });
        return response.arrayBuffer().then(function(buf) {
          var bytes = new Uint8Array(buf);
          var binary = "";
          for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          var body = btoa(binary);
          return { status: response.status, headers: respHeaders, body: body, bodyBase64: true };
        });
      })
      .then(function(result) {
        ws.send(JSON.stringify({ id: id, response: result }));
      })
      .catch(function(err) {
        ws.send(JSON.stringify({
          id: id,
          response: { status: 0, headers: {}, body: "Fetch error: " + err.message }
        }));
      });
    });

    ws.addEventListener("close", function() {
      console.log("[chatgpt-etl] Disconnected from bridge");
    });

    ws.addEventListener("error", function(err) {
      console.error("[chatgpt-etl] WebSocket error:", err);
    });
  }).catch(function(err) {
    console.error("[chatgpt-etl] Failed to get access token:", err);
  });
})();`;
  return compact ? minify(script) : script;
}
