export function generateBrowserScript(port: number): string {
  return `(function() {
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

    fetch(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: "include"
    })
    .then(function(response) {
      var headers = {};
      response.headers.forEach(function(value, key) {
        headers[key] = value;
      });
      return response.text().then(function(body) {
        return { status: response.status, headers: headers, body: body };
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
})();`;
}
