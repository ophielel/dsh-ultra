/* dsh-ultra client half — shows an "ULTRA" badge while the session mode is on.
 * Reads the host "ultra" session projection via useProjection (wire view: { active }).
 */
window.__ModuleLoader__.load({
  id: "dsh-ultra",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");

    var inject = ["slots"];

    var BADGE_STYLE = {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      width: "fit-content",
      padding: "3px 10px",
      borderRadius: "6px",
      border: "1px solid rgba(168, 85, 247, 0.45)",
      background: "rgba(168, 85, 247, 0.12)",
      color: "inherit",
      fontSize: "11px",
      lineHeight: "16px",
      fontFamily: "inherit",
      userSelect: "none",
      whiteSpace: "nowrap"
    };
    var DOT_STYLE = {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#a855f7",
      flex: "none",
      boxShadow: "0 0 6px rgba(168, 85, 247, 0.9)"
    };
    var WRAP_STYLE = {
      display: "flex",
      justifyContent: "center",
      width: "100%"
    };

    function UltraBadge(props) {
      var useProjection = props.useProjection;
      var ultra = typeof useProjection === "function" ? useProjection("ultra") : undefined;
      if (!ultra || ultra.active !== true) return null;

      return react.createElement(
        "div",
        { style: WRAP_STYLE },
        react.createElement(
          "div",
          { style: BADGE_STYLE, "data-ultra": "on", title: "Ultra 模式已开启 · /ultra off 关闭" },
          react.createElement("span", { style: DOT_STYLE }),
          react.createElement("span", null, "ULTRA · 编排 + max")
        )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", () =>
        ctx.slots.register(
          { name: "conversation.input.dock", id: "ultra", order: 31 },
          UltraBadge
        )
      );
    }

    exports.name = "dsh-ultra";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
