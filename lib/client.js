window.__ModuleLoader__.load({
  id: "@sqnb/dsh-skill-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { bindSnapshotSelector } = require("@deepseek-ai/dsh-client-web-react");
    const { createSnapshotStore } = require("@deepseek-ai/dsh-client-runtime/client");

    const NS = "settings.skillManager";
    const SETTINGS_ROUTE = "/dsh-skill-manager/settings";
    const CLIENT_REQUEST_HEADERS = { "x-dsh-skill-manager": "1" };

    const zh = {
      nav: "Skills",
      title: "Skill 管理",
      intro: "配置本地 skill 扫描路径，并控制哪些 skill 可被调用。",
      officialRoots: "使用 DSH 官方默认路径",
      officialRootsHint: "包括项目级、用户级和内置路径，其中包含 ~/.agents/skills。",
      pathsTitle: "扫描路径",
      pathsHint: "输入绝对路径；每个路径应直接包含 SKILL.md 文件或 skill 子目录。",
      pathPlaceholder: "例如 C:/workspace/skills",
      addPath: "添加路径",
      removePath: "移除",
      skillsTitle: "已发现的 Skills",
      skillsHint: "启用项会出现在 skill 调用目录中；禁用项不会被模型或用户调用。",
      enabled: "启用",
      disabled: "禁用",
      empty: "当前会话没有发现可管理的 skill。",
      noSession: "没有可用会话，暂时无法读取 skill 目录。",
      loading: "加载中…",
      refresh: "刷新",
      readOnly: "当前设置提供方为只读，无法保存修改。",
      saveFailed: "保存失败",
      loadFailed: "加载失败",
      pathRequired: "请输入路径。",
      disabledDescription: "此 skill 已被设置禁用。",
      noDescription: "没有描述。",
      expand: "展开",
      collapse: "收起",
    };
    const en = {
      nav: "Skills",
      title: "Skill Manager",
      intro: "Configure local skill roots and control which skills can be invoked.",
      officialRoots: "Use DSH official default roots",
      officialRootsHint: "Project, user, and bundled roots are included, including ~/.agents/skills.",
      pathsTitle: "Scan paths",
      pathsHint: "Enter absolute paths. Each path should contain SKILL.md files or skill directories.",
      pathPlaceholder: "For example C:/workspace/skills",
      addPath: "Add path",
      removePath: "Remove",
      skillsTitle: "Discovered skills",
      skillsHint: "Enabled skills appear in the invocation catalog; disabled skills cannot be invoked.",
      enabled: "Enabled",
      disabled: "Disabled",
      empty: "No manageable skills were found for the current session.",
      noSession: "There is no session available to read the skill catalog.",
      loading: "Loading…",
      refresh: "Refresh",
      readOnly: "The current settings provider is read-only.",
      saveFailed: "Save failed",
      loadFailed: "Load failed",
      pathRequired: "Enter a path.",
      disabledDescription: "This skill is disabled in settings.",
      noDescription: "No description.",
      expand: "Expand",
      collapse: "Collapse",
    };

    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
    }

    function normalizeSettings(value) {
      const input = value && typeof value === "object" ? value : {};
      const uniqueStrings = candidate => Array.isArray(candidate) ? [...new Set(candidate.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean))] : [];
      return {
        includeDefaultRoots: input.includeDefaultRoots !== false,
        paths: uniqueStrings(input.paths),
        disabled: uniqueStrings(input.disabled),
      };
    }

    async function requestSettings(method, value) {
      const options = { method, headers: CLIENT_REQUEST_HEADERS };
      if (value !== undefined) {
        options.headers = { ...CLIENT_REQUEST_HEADERS, "content-type": "application/json" };
        options.body = JSON.stringify(value);
      }
      const response = await fetch(SETTINGS_ROUTE, options);
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Skill Manager host returned an invalid response");
      }
      if (!response.ok) throw new Error(payload.error || "Skill Manager host request failed (" + response.status + ")");
      return normalizeSettings(payload.settings);
    }

    function createSettingsController() {
      const store = createSnapshotStore({
        status: "idle",
        error: null,
        writable: true,
        revision: 0,
        value: { includeDefaultRoots: true, paths: [], disabled: [] },
      });
      let generation = 0;
      return {
        store,
        async load() {
          const currentGeneration = ++generation;
          store.update(state => { state.status = "loading"; state.error = null; });
          try {
            const value = await requestSettings("GET");
            if (currentGeneration !== generation) return;
            store.update(state => {
              state.status = "ready";
              state.error = null;
              state.writable = true;
              state.revision += 1;
              state.value = value;
            });
          } catch (error) {
            if (currentGeneration !== generation) return;
            store.update(state => { state.status = "error"; state.error = messageOf(error); });
          }
        },
        async update(patch) {
          const state = store.getSnapshot();
          const value = await requestSettings("PUT", { ...state.value, ...patch });
          store.update(next => {
            next.status = "ready";
            next.error = null;
            next.writable = true;
            next.revision += 1;
            next.value = value;
          });
        },
      };
    }

    function createCatalogController(skillsApi) {
      const store = createSnapshotStore({ status: "idle", error: null, sessionId: undefined, skills: [] });
      let generation = 0;
      return {
        store,
        async load(sessionId) {
          const currentGeneration = ++generation;
          const previous = store.getSnapshot();
          const keepVisible = previous.sessionId === sessionId && previous.skills.length > 0;
          store.update(state => { state.status = keepVisible ? "refreshing" : "loading"; state.error = null; state.sessionId = sessionId; });
          if (sessionId === undefined) {
            store.update(state => { state.status = "ready"; state.skills = []; });
            return;
          }
          try {
            const response = await skillsApi.list({ sessionId });
            if (currentGeneration !== generation) return;
            if (!response.result.ok) throw new Error(response.result.error.message);
            store.update(state => { state.status = "ready"; state.error = null; state.skills = response.result.value.skills; });
          } catch (error) {
            if (currentGeneration !== generation) return;
            store.update(state => { state.status = "error"; state.error = messageOf(error); state.skills = []; });
          }
        },
      };
    }

    function h(type, props, ...children) {
      return React.createElement(type, props, ...children);
    }

    function findScrollContainer(node) {
      if (typeof window === "undefined" || typeof document === "undefined") return null;
      let current = node?.parentElement;
      while (current !== null) {
        const overflowY = window.getComputedStyle(current).overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
        current = current.parentElement;
      }
      return document.scrollingElement;
    }

    function captureScrollPosition(node) {
      const element = findScrollContainer(node);
      return element === null ? null : { element, top: element.scrollTop, left: element.scrollLeft };
    }

    function restoreScrollPosition(snapshot) {
      if (snapshot === null) return;
      const schedule = callback => typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : setTimeout(callback, 0);
      schedule(() => schedule(() => {
        if (!snapshot.element.isConnected) return;
        snapshot.element.scrollTop = snapshot.top;
        snapshot.element.scrollLeft = snapshot.left;
      }));
    }

    const styles = {
      section: { width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 14, color: "var(--dsw-alias-label-primary)" },
      title: { margin: 0, color: "var(--dsw-alias-label-primary)", fontSize: 20, fontWeight: 600, lineHeight: "28px" },
      intro: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: 13, lineHeight: "20px" },
      group: { display: "flex", flexDirection: "column", gap: 8, padding: "16px 0", borderBottom: "1px solid var(--dsw-alias-border-l2)" },
      groupTitle: { margin: 0, color: "var(--dsw-alias-label-primary)", fontSize: 14, fontWeight: 400, lineHeight: "22px" },
      hint: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: "20px" },
      row: { display: "flex", alignItems: "center", gap: 12, minHeight: 40, padding: "8px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      rowMain: { flex: 1, minWidth: 0 },
      name: { display: "block", color: "var(--dsw-alias-label-primary)", fontSize: 14, fontWeight: 600, lineHeight: "20px", overflowWrap: "anywhere" },
      description: { display: "block", marginTop: 2, color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: "18px", overflowWrap: "anywhere" },
      descriptionCollapsed: { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" },
      textButton: { display: "inline-flex", alignItems: "center", minHeight: 20, marginTop: 2, padding: 0, border: "none", background: "transparent", color: "var(--dsw-alias-state-business-primary)", font: "inherit", fontSize: 13, lineHeight: "20px", cursor: "pointer" },
      path: { flex: 1, minWidth: 0, color: "var(--dsw-alias-label-secondary)", fontFamily: "var(--ds-font-family-code, ui-monospace, SFMono-Regular, Consolas, monospace)", fontSize: 13, lineHeight: "20px", overflowWrap: "anywhere" },
      input: { flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, outline: "none", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 13 },
      addRow: { display: "flex", gap: 8, alignItems: "stretch", width: "100%" },
      button: { flex: "none", minHeight: 32, padding: "4px 10px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 6, background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 13, lineHeight: "20px", whiteSpace: "nowrap", cursor: "pointer" },
      buttonPrimary: { flex: "none", minHeight: 36, padding: "6px 12px", border: "1px solid var(--dsw-alias-state-business-primary)", borderRadius: 8, background: "var(--dsw-alias-state-business-primary)", color: "#fff", font: "inherit", fontSize: 13, lineHeight: "20px", whiteSpace: "nowrap", cursor: "pointer" },
      checkboxRow: { display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 0", cursor: "pointer" },
      checkbox: { flex: "none", width: 16, height: 16, margin: "2px 0 0" },
      status: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: "20px" },
      error: { margin: 0, padding: "8px 10px", border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent)", borderRadius: 6, color: "var(--dsw-alias-state-error-primary)", background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)", fontSize: 13, lineHeight: "20px" },
      toolbar: { display: "flex", justifyContent: "flex-end", marginBottom: 0 },
    };

    function SkillManagerSection(props) {
      if (props.controller === undefined || props.catalog === undefined || props.useSettings === undefined || props.useCatalog === undefined || props.useSessions === undefined || props.t === undefined) return null;
      const settingsState = props.useSettings(state => state);
      const catalogState = props.useCatalog(state => state);
      const sessionState = props.useSessions(state => state);
      const sessionId = sessionState.current;
      const [pathDraft, setPathDraft] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [expandedDescriptions, setExpandedDescriptions] = React.useState(() => new Set());
      const t = props.t;
      const rootRef = React.useRef(null);
      const scrollSnapshot = React.useRef(null);

      React.useEffect(() => {
        if (settingsState.status === "idle") void props.controller.load();
      }, [settingsState.status]);
      React.useEffect(() => {
        void props.catalog.load(sessionId);
      }, [sessionId]);

      const commit = async patch => {
        if (busy) return false;
        scrollSnapshot.current = captureScrollPosition(rootRef.current);
        setBusy(true);
        setError(null);
        try {
          await props.controller.update(patch);
          await props.catalog.load(sessionId);
          return true;
        } catch (commitError) {
          setError(messageOf(commitError));
          return false;
        } finally {
          restoreScrollPosition(scrollSnapshot.current);
          scrollSnapshot.current = null;
          setBusy(false);
        }
      };

      if (settingsState.status === "idle" || settingsState.status === "loading") return h("div", { style: styles.section }, h("p", { style: styles.status }, t("loading")));
      if (settingsState.status === "error") return h("div", { style: styles.section }, h("p", { style: styles.error }, t("loadFailed") + ": " + settingsState.error));

      const value = settingsState.value;
      const disabledNames = new Set(value.disabled);
      const rows = catalogState.skills.map(skill => ({
        name: skill.name,
        description: skill.description || t("noDescription"),
        expandable: typeof skill.description === "string" && skill.description.trim().length > 0,
        enabled: !disabledNames.has(skill.name),
      }));
      const knownNames = new Set(rows.map(row => row.name));
      for (const name of value.disabled) {
        if (!knownNames.has(name)) rows.push({ name, description: t("disabledDescription"), expandable: false, enabled: false });
      }
      rows.sort((left, right) => left.name.localeCompare(right.name));

      const addPath = async () => {
        const path = pathDraft.trim();
        if (path.length === 0) {
          setError(t("pathRequired"));
          return;
        }
        if (value.paths.includes(path)) {
          setPathDraft("");
          return;
        }
        if (await commit({ paths: value.paths.concat(path) })) setPathDraft("");
      };
      const removePath = path => { void commit({ paths: value.paths.filter(entry => entry !== path) }); };
      const toggleSkill = name => {
        const disabled = disabledNames.has(name)
          ? value.disabled.filter(entry => entry !== name)
          : value.disabled.concat(name);
        void commit({ disabled });
      };
      const toggleDescription = name => {
        setExpandedDescriptions(previous => {
          const next = new Set(previous);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return next;
        });
      };
      const refresh = async () => {
        if (busy) return;
        scrollSnapshot.current = captureScrollPosition(rootRef.current);
        try {
          await Promise.all([props.controller.load(), props.catalog.load(sessionId)]);
        } finally {
          restoreScrollPosition(scrollSnapshot.current);
          scrollSnapshot.current = null;
        }
      };

      return h("div", { style: styles.section, ref: rootRef },
        h("h2", { style: styles.title }, t("title")),
        h("p", { style: styles.intro }, t("intro")),
        error === null ? null : h("p", { style: styles.error, role: "alert" }, t("saveFailed") + ": " + error),
        settingsState.writable ? null : h("p", { style: styles.error, role: "status" }, t("readOnly")),
        h("section", { style: styles.group },
          h("h3", { style: styles.groupTitle }, t("officialRoots")),
          h("label", { style: styles.checkboxRow },
            h("input", { style: styles.checkbox, type: "checkbox", checked: value.includeDefaultRoots, disabled: !settingsState.writable || busy, onChange: event => { void commit({ includeDefaultRoots: event.target.checked }); } }),
            h("span", null,
              h("span", { style: styles.name }, t("officialRoots")),
              h("span", { style: styles.description }, t("officialRootsHint"))
            )
          )
        ),
        h("section", { style: styles.group },
          h("h3", { style: styles.groupTitle }, t("pathsTitle")),
          h("p", { style: styles.hint }, t("pathsHint")),
          value.paths.length === 0 ? h("p", { style: styles.status }, t("empty")) : value.paths.map(path => h("div", { key: path, style: styles.row }, h("span", { style: styles.path }, path), h("button", { type: "button", style: styles.button, disabled: !settingsState.writable || busy, onClick: () => removePath(path) }, t("removePath")))),
          h("div", { style: styles.addRow },
            h("input", { style: styles.input, value: pathDraft, placeholder: t("pathPlaceholder"), disabled: !settingsState.writable || busy, onChange: event => setPathDraft(event.target.value), onKeyDown: event => { if (event.key === "Enter") void addPath(); } }),
            h("button", { type: "button", style: styles.buttonPrimary, disabled: !settingsState.writable || busy, onClick: () => { void addPath(); } }, t("addPath"))
          )
        ),
        h("section", { style: styles.group },
          h("div", { style: styles.toolbar }, h("button", { type: "button", style: styles.button, disabled: busy, onClick: refresh }, t("refresh"))),
          h("h3", { style: styles.groupTitle }, t("skillsTitle")),
          h("p", { style: styles.hint }, t("skillsHint")),
          sessionId === undefined ? h("p", { style: styles.status }, t("noSession")) : catalogState.status === "loading" ? h("p", { style: styles.status }, t("loading")) : catalogState.status === "error" ? h("p", { style: styles.error }, t("loadFailed") + ": " + catalogState.error) : rows.length === 0 ? h("p", { style: styles.status }, t("empty")) : rows.map(row => {
            const expanded = expandedDescriptions.has(row.name);
            const descriptionStyle = row.expandable && !expanded ? { ...styles.description, ...styles.descriptionCollapsed } : styles.description;
            return h("div", { key: row.name, style: styles.row },
              h("span", { style: styles.rowMain },
                h("span", { style: styles.name }, row.name),
                h("span", { style: descriptionStyle }, row.description),
                row.expandable ? h("button", { type: "button", style: styles.textButton, "aria-expanded": expanded, onClick: () => toggleDescription(row.name) }, expanded ? t("collapse") : t("expand")) : null
              ),
              h("input", { style: styles.checkbox, type: "checkbox", checked: row.enabled, disabled: !settingsState.writable || busy, "aria-label": row.name, onChange: () => toggleSkill(row.name) })
            );
          })
        )
      );
    }

    const inject = ["slots", "locale", "connection", "sessions"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-manager dictionaries");
      const connection = ctx.get("connection");
      const sessions = ctx.get("sessions");
      const controller = createSettingsController();
      const catalog = createCatalogController(connection.api.skills);
      const useSettings = bindSnapshotSelector(controller.store);
      const useCatalog = bindSnapshotSelector(catalog.store);
      const useSessions = bindSnapshotSelector(sessions.list);
      const t = ctx.locale.bind(NS);
      const refresh = () => {
        void controller.load();
        void catalog.load(sessions.list.getSnapshot().current);
      };
      ctx.effect(() => {
        const disposers = [
          ctx.on("connection/reset", refresh),
        ];
        return () => { for (const dispose of disposers) dispose(); };
      }, "skill-manager invalidations");
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "skill-manager",
        order: 25,
        label: () => t("nav"),
        inject: () => ({ controller, catalog, useSettings, useCatalog, useSessions, t }),
      }, SkillManagerSection));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
