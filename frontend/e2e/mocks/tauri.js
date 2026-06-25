(function () {
  var saved = {};
  try { saved = JSON.parse(window.name); } catch (e) {}
  var handlers = saved.handlers || {};
  var eventIdCounter = saved.eventIdCounter || 0;

  function save() {
    try {
      window.name = JSON.stringify({ handlers: handlers, eventIdCounter: eventIdCounter });
    } catch (e) {}
  }

  function eventBus(event, payload) {
    var evtHandlers = handlers["__event__"];
    if (!evtHandlers) return;
    var list = evtHandlers[event];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      list[i].cb({ payload: payload, event: event, id: 0 });
    }
  }

  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd, args) {
      var handler = handlers[cmd];
      if (handler) {
        try {
          var result = handler(args || {});
          if (result && typeof result.then === "function") return result;
          return Promise.resolve(result);
        } catch (e) {
          return Promise.reject(String(e));
        }
      }
      return Promise.reject("No mock handler for: " + cmd);
    },
    listen: function (event, cb) {
      if (!handlers["__event__"]) handlers["__event__"] = {};
      if (!handlers["__event__"][event]) handlers["__event__"][event] = [];
      var id = ++eventIdCounter;
      handlers["__event__"][event].push({ id: id, cb: cb });
      save();
      return Promise.resolve(function () {
        var arr = handlers["__event__"][event];
        if (arr) {
          var idx = -1;
          for (var j = 0; j < arr.length; j++) {
            if (arr[j].id === id) { idx = j; break; }
          }
          if (idx >= 0) arr.splice(idx, 1);
          save();
        }
      });
    },
    emit: function (event, payload) {
      eventBus(event, payload);
    },
    convertFileSrc: function (p) { return p; },
  };

  window.__TAURI_MOCK__ = {
    setHandler: function (cmd, handler) {
      handlers[cmd] = handler;
      save();
    },
    setResponse: function (cmd, response) {
      handlers[cmd] = function () { return response; };
      save();
    },
    getHandler: function (cmd) { return handlers[cmd]; },
    emitEvent: function (event, payload) { eventBus(event, payload); },
    reset: function () {
      handlers = {};
      eventIdCounter = 0;
      save();
    },
  };

  // Default responses (overridable via setResponse before navigation)
  if (!handlers["get_kubeconfig_status"]) {
    window.__TAURI_MOCK__.setResponse("get_kubeconfig_status", {
      configured: true,
      error: null,
    });
  }
  if (!handlers["get_last_kubeconfig_path"]) {
    window.__TAURI_MOCK__.setResponse("get_last_kubeconfig_path", null);
  }
  if (!handlers["get_active_context"]) {
    window.__TAURI_MOCK__.setResponse("get_active_context", "minikube");
  }
  if (!handlers["list_kubeconfigs"]) {
    window.__TAURI_MOCK__.setResponse("list_kubeconfigs", []);
  }
  if (!handlers["get_contexts"]) {
    window.__TAURI_MOCK__.setResponse("get_contexts", [
      { name: "minikube", cluster: "minikube", is_active: true },
      { name: "prod", cluster: "prod-cluster", is_active: false },
    ]);
  }
  if (!handlers["reload_kubeconfig"]) {
    window.__TAURI_MOCK__.setResponse("reload_kubeconfig", {
      configured: true,
      error: null,
    });
  }
  if (!handlers["add_kubeconfig"]) {
    window.__TAURI_MOCK__.setResponse("add_kubeconfig", "mock-session-id");
  }
  if (!handlers["remove_kubeconfig"]) {
    window.__TAURI_MOCK__.setResponse("remove_kubeconfig", null);
  }
  if (!handlers["switch_kubeconfig"]) {
    window.__TAURI_MOCK__.setResponse("switch_kubeconfig", null);
  }
  if (!handlers["get_pod_names"]) {
    window.__TAURI_MOCK__.setResponse("get_pod_names", [
      "nginx-abc123",
      "api-xyz789",
    ]);
  }
})();
