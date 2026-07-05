"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useSettingsStore,
  getModelById,
  getAllModels,
  VENDOR_KEY_URLS,
  type ModelOption,
  type CustomModelInput,
  type ServerModelConfig,
  type ThemeId,
} from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  Moon,
  Sun,
  ExternalLink,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  X,
  User,
  Mail,
  Lock,
  Key,
  KeyRound,
  Shield,
  Copy,
  Check,
  LogOut,
  UserCog,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  HardDrive,
  Loader2,
  Circle,
} from "lucide-react";

const VENDOR_LINKS: Record<string, { name: string; url: string }> = {
  DeepSeek: { name: "DeepSeek 开放平台", url: "https://platform.deepseek.com/" },
  通义千问: { name: "阿里云百炼", url: "https://bailian.console.aliyun.com/" },
  豆包: { name: "火山引擎方舟", url: "https://console.volcengine.com/ark" },
  智谱: { name: "智谱 BigModel", url: "https://open.bigmodel.cn/" },
  Kimi: { name: "Moonshot AI", url: "https://platform.moonshot.cn/" },
  OpenAI: { name: "OpenAI Platform", url: "https://platform.openai.com/" },
  文心一言: { name: "百度千帆", url: "https://qianfan.cloud.baidu.com/" },
  小米: { name: "小米 MiMo", url: "https://mimo.xiaomi.com/" },
  MiniMax: { name: "MiniMax 开放平台", url: "https://www.minimaxi.com/" },
};

function groupByVendor(models: ModelOption[]) {
  const order = [
    "内置",
    "OpenAI",
    "DeepSeek",
    "通义千问",
    "豆包",
    "智谱",
    "Kimi",
    "文心一言",
    "小米",
    "MiniMax",
    "自定义",
  ];
  const map = new Map<string, ModelOption[]>();
  for (const m of models) {
    const v = m.custom ? "自定义" : (m.vendor ?? "其他");
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(([vendor, models]) => ({ vendor, models }));
}

interface ModelCardState {
  expanded: boolean;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  revealKey: boolean;
  saving: boolean;
  testing: boolean;
  testResult: { ok: boolean; msg: string } | null;
}

function defaultCardState(
  modelId: string,
  model: ModelOption | undefined,
  modelApiKeys: Record<string, string>,
  serverConfigs: Record<string, ServerModelConfig>,
  globalTemp: number,
  isLoggedIn: boolean,
  existing?: ModelCardState,
): ModelCardState {
  const localKey = modelApiKeys[modelId] || (model?.custom && model.apiKey) || "";
  const serverCfg = serverConfigs[modelId];
  const baseUrl = existing?.baseUrl || model?.baseUrl || serverCfg?.baseUrl || "";
  const temp = existing?.temperature ?? serverCfg?.temperature ?? globalTemp;
  return {
    expanded: existing?.expanded ?? false,
    apiKey: existing?.apiKey ?? "",
    baseUrl,
    temperature: temp,
    revealKey: existing?.revealKey ?? false,
    saving: false,
    testing: false,
    testResult: null,
  };
}

export default function SettingsPage() {
  const router = useRouter();

  const hydrated = useSettingsStore((s) => s.hydrated);
  const storedModelId = useSettingsStore((s) => s.modelId);
  const storedTemp = useSettingsStore((s) => s.temperature);
  const storedTheme = useSettingsStore((s) => s.theme);
  const customModels = useSettingsStore((s) => s.customModels);
  const modelApiKeys = useSettingsStore((s) => s.modelApiKeys);
  const serverConfigs = useSettingsStore((s) => s.serverConfigs);

  const setModel = useSettingsStore((s) => s.setModel);
  const setTemperature = useSettingsStore((s) => s.setTemperature);
  const setThemeStore = useSettingsStore((s) => s.setTheme);
  const setLoggedIn = useSettingsStore((s) => s.setLoggedIn);
  const setServerConfigs = useSettingsStore((s) => s.setServerConfigs);
  const setLocalModelKey = useSettingsStore((s) => s.setLocalModelKey);
  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const updateCustomModel = useSettingsStore((s) => s.updateCustomModel);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);
  const resetSettings = useSettingsStore((s) => s.reset);

  const actionsRef = useRef({
    setModel,
    setTemperature,
    setThemeStore,
    setLoggedIn,
    setServerConfigs,
    setLocalModelKey,
    addCustomModel,
    updateCustomModel,
    removeCustomModel,
    resetSettings,
  });
  actionsRef.current = {
    setModel,
    setTemperature,
    setThemeStore,
    setLoggedIn,
    setServerConfigs,
    setLocalModelKey,
    addCustomModel,
    updateCustomModel,
    removeCustomModel,
    resetSettings,
  };

  const authUser = useAuthStore((s) => s.user);
  const authError = useAuthStore((s) => s.error);
  const authUpdateProfile = useAuthStore((s) => s.updateProfile);
  const authChangePassword = useAuthStore((s) => s.changePassword);
  const authCreateApiKey = useAuthStore((s) => s.createApiKey);
  const authRevokeApiKey = useAuthStore((s) => s.revokeApiKey);
  const authLogout = useAuthStore((s) => s.logout);
  const authIsAdmin = useAuthStore((s) => s.isAdmin);
  const authApiKeys = useAuthStore((s) => s.apiKeys);
  const isLoggedIn = !!authUser;

  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState<CustomModelInput>({
    label: "",
    modelId: "",
    baseUrl: "",
    vendor: "",
    apiKey: "",
  });
  const [customReveal, setCustomReveal] = useState(false);
  const [cardStates, setCardStates] = useState<Record<string, ModelCardState>>({});
  const [globalTemp, setGlobalTemp] = useState(0.7);
  const [theme, setTheme] = useState<ThemeId>("cyber-dark");

  const [profileName, setProfileName] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | undefined>(undefined);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverConfigsLoaded, setServerConfigsLoaded] = useState(false);

  const allModels = useMemo(() => getAllModels(customModels), [customModels]);
  const modelGroups = useMemo(() => groupByVendor(allModels), [allModels]);

  useEffect(() => {
    if (hydrated) {
      setGlobalTemp(storedTemp);
      setTheme(storedTheme);
      actionsRef.current.setLoggedIn(!!authUser);
    }
  }, [hydrated, storedTemp, storedTheme, authUser]);

  useEffect(() => {
    if (!isLoggedIn || !hydrated) {
      setServerConfigsLoaded(false);
      return;
    }
    if (serverConfigsLoaded) return;

    let cancelled = false;
    (async () => {
      setServerLoading(true);
      try {
        const res = await fetch("/api/model-configs", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        actionsRef.current.setServerConfigs(data.configs || [], data.activeModelId || null);
        if (data.activeModelId) {
          actionsRef.current.setModel(data.activeModelId);
        }
        const states: Record<string, ModelCardState> = {};
        for (const cfg of (data.configs || []) as ServerModelConfig[]) {
          states[cfg.modelId] = {
            expanded: false,
            apiKey: "",
            baseUrl: cfg.baseUrl,
            temperature: cfg.temperature,
            revealKey: false,
            saving: false,
            testing: false,
            testResult: null,
          };
        }
        setCardStates((prev) => ({ ...prev, ...states }));
        setServerConfigsLoaded(true);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, hydrated, serverConfigsLoaded]);

  useEffect(() => {
    if (authUser) {
      setProfileName(authUser.name || "");
    }
  }, [authUser?.userId]);

  const updateCardState = (
    modelId: string,
    model: ModelOption | undefined,
    updates: Partial<ModelCardState>,
  ) => {
    setCardStates((prev) => {
      const existing = prev[modelId];
      const next = defaultCardState(
        modelId,
        model,
        modelApiKeys,
        serverConfigs,
        globalTemp,
        isLoggedIn,
        existing,
      );
      return { ...prev, [modelId]: { ...next, ...updates } };
    });
  };

  const getCardState = (modelId: string, model?: ModelOption): ModelCardState => {
    const existing = cardStates[modelId];
    return defaultCardState(
      modelId,
      model,
      modelApiKeys,
      serverConfigs,
      globalTemp,
      isLoggedIn,
      existing,
    );
  };

  const isModelConfigured = (modelId: string, model?: ModelOption) => {
    if (modelId === "mock-default") return true;
    if (isLoggedIn) return !!serverConfigs[modelId]?.hasKey;
    return !!(modelApiKeys[modelId] || (model?.custom && model.apiKey));
  };

  const toggleExpand = (modelId: string, model: ModelOption) => {
    const cur = getCardState(modelId, model);
    updateCardState(modelId, model, {
      expanded: !cur.expanded,
      baseUrl: cur.baseUrl || model.baseUrl || serverConfigs[modelId]?.baseUrl || "",
    });
  };

  const handleSaveKey = async (modelId: string, model: ModelOption) => {
    const state = getCardState(modelId, model);
    if (!state.apiKey.trim()) return;

    updateCardState(modelId, model, { saving: true, testResult: null });

    if (isLoggedIn) {
      try {
        const res = await fetch("/api/model-configs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            modelId,
            label: model.label,
            vendor: model.vendor || "",
            baseUrl: state.baseUrl || model.baseUrl || "",
            apiKey: state.apiKey,
            temperature: state.temperature,
          }),
        });
        if (res.ok) {
          const r = await fetch("/api/model-configs", { credentials: "include" });
          if (r.ok) {
            const data = await r.json();
            setServerConfigs(data.configs || [], data.activeModelId || null);
          }
          updateCardState(modelId, model, {
            saving: false,
            apiKey: "",
            testResult: { ok: true, msg: "已保存（已加密）" },
          });
          setTimeout(() => updateCardState(modelId, model, { testResult: null }), 2000);
        } else {
          const err = await res.text();
          updateCardState(modelId, model, {
            saving: false,
            testResult: { ok: false, msg: `保存失败: ${err.slice(0, 100)}` },
          });
        }
      } catch (err) {
        updateCardState(modelId, model, {
          saving: false,
          testResult: { ok: false, msg: String(err) },
        });
      }
    } else {
      setLocalModelKey(modelId, state.apiKey);
      updateCardState(modelId, model, {
        saving: false,
        apiKey: "",
        testResult: { ok: true, msg: "已保存到本地" },
      });
      setTimeout(() => updateCardState(modelId, model, { testResult: null }), 2000);
    }
  };

  const handleTestKey = async (modelId: string, model: ModelOption) => {
    const state = getCardState(modelId, model);
    if (!state.apiKey.trim() && !isModelConfigured(modelId, model)) {
      updateCardState(modelId, model, { testResult: { ok: false, msg: "请先输入 API Key" } });
      return;
    }

    updateCardState(modelId, model, { testing: true, testResult: null });

    try {
      const testKey =
        state.apiKey.trim() || modelApiKeys[modelId] || (model.custom ? model.apiKey : "");
      if (!testKey) {
        updateCardState(modelId, model, {
          testing: false,
          testResult: { ok: false, msg: "未配置 Key" },
        });
        return;
      }
      const res = await fetch("/api/model-configs/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelId: model.model || modelId,
          baseUrl: state.baseUrl || model.baseUrl || "",
          apiKey: testKey,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        updateCardState(modelId, model, {
          testing: false,
          testResult: { ok: true, msg: "连接成功！" },
        });
      } else {
        updateCardState(modelId, model, {
          testing: false,
          testResult: { ok: false, msg: data.error || "连接失败" },
        });
      }
    } catch (err) {
      updateCardState(modelId, model, {
        testing: false,
        testResult: { ok: false, msg: String(err) },
      });
    }
  };

  const handleActivate = async (modelId: string) => {
    setModel(modelId);
    if (isLoggedIn) {
      try {
        await fetch("/api/model-configs/activate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ modelId }),
        });
      } catch {
        // ignore
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClearKey = async (modelId: string, model: ModelOption) => {
    if (isLoggedIn) {
      updateCardState(modelId, model, { saving: true });
      try {
        await fetch(`/api/model-configs?modelId=${encodeURIComponent(modelId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const r = await fetch("/api/model-configs", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          setServerConfigs(data.configs || [], data.activeModelId || null);
        }
        updateCardState(modelId, model, {
          saving: false,
          apiKey: "",
          testResult: { ok: true, msg: "已清除" },
        });
        setTimeout(() => updateCardState(modelId, model, { testResult: null }), 1500);
      } catch {
        updateCardState(modelId, model, { saving: false });
      }
    } else {
      useSettingsStore.setState((s) => {
        const rest = { ...s.modelApiKeys };
        delete rest[modelId];
        return { modelApiKeys: rest };
      });
      updateCardState(modelId, model, { apiKey: "", testResult: { ok: true, msg: "已清除" } });
      setTimeout(() => updateCardState(modelId, model, { testResult: null }), 1500);
    }
  };

  const saveGeneralSettings = () => {
    setTemperature(globalTemp);
    setThemeStore(theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const resetCustomForm = () => {
    setCustomForm({ label: "", modelId: "", baseUrl: "", vendor: "", apiKey: "" });
    setShowAddForm(false);
    setEditingId(null);
  };

  const startEdit = (m: ModelOption) => {
    setEditingId(m.id);
    setShowAddForm(true);
    setCustomForm({
      label: m.label,
      modelId: m.model || m.id,
      baseUrl: m.baseUrl || "",
      vendor: m.vendor || "自定义",
      apiKey: m.apiKey || "",
    });
    setCustomReveal(true);
  };

  const saveCustomModel = () => {
    if (!customForm.label.trim() || !customForm.modelId.trim() || !customForm.baseUrl.trim())
      return;
    const actions = actionsRef.current;
    if (editingId) {
      actions.updateCustomModel(editingId, customForm);
    } else {
      const newModel = actions.addCustomModel(customForm);
      handleActivate(newModel.id);
    }
    resetCustomForm();
  };

  const deleteCustomModel = (id: string) => {
    actionsRef.current.removeCustomModel(id);
  };

  const handleUpdateProfile = async () => {
    setProfileMsg(null);
    const ok = await authUpdateProfile({ name: profileName });
    if (ok) {
      setProfileMsg({ type: "success", text: "资料已更新" });
      setTimeout(() => setProfileMsg(null), 2000);
    } else {
      setProfileMsg({ type: "error", text: authError || "更新失败" });
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ type: "error", text: "两次密码不一致" });
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordMsg({ type: "error", text: "密码至少 6 位" });
      return;
    }
    const ok = await authChangePassword(passwordForm.current, passwordForm.new);
    if (ok) {
      setPasswordMsg({ type: "success", text: "密码已修改" });
      setPasswordForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setPasswordMsg(null), 2000);
    } else {
      setPasswordMsg({ type: "error", text: authError || "修改失败" });
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    const result = await authCreateApiKey(newKeyName.trim(), newKeyExpiry);
    if (result.key) {
      setCreatedKey(result.key);
      setNewKeyName("");
      setNewKeyExpiry(undefined);
    }
  };

  const copyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    actionsRef.current.setLoggedIn(false);
    router.push("/auth");
  };

  const getKeyPlaceholder = (vendor?: string) => {
    if (vendor === "小米") return "输入 MiMo API Key";
    if (vendor === "DeepSeek" || vendor === "OpenAI") return "sk-...";
    if (vendor === "通义千问") return "sk-...（DashScope API Key）";
    if (vendor === "豆包") return "输入火山引擎 API Key";
    if (vendor === "智谱") return "输入智谱 API Key";
    if (vendor === "Kimi") return "sk-...（Moonshot API Key）";
    if (vendor === "文心一言") return "输入千帆 API Key";
    if (vendor === "MiniMax") return "输入 MiniMax API Key";
    return "输入 API Key";
  };

  const renderModelCard = (m: ModelOption) => {
    const state = getCardState(m.id, m);
    const isActive = storedModelId === m.id;
    const configured = isModelConfigured(m.id, m);
    const serverCfg = serverConfigs[m.id];
    const vendorLink = VENDOR_KEY_URLS[m.vendor || ""];

    return (
      <div
        key={m.id}
        className={`rounded-lg border transition-all ${
          isActive
            ? "border-cyber-cyan bg-cyber-cyan/5 shadow-neon"
            : "border-cyber-border bg-cyber-surface/40 hover:border-cyber-cyan/40"
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => handleActivate(m.id)}
            className="flex flex-1 items-center gap-2 text-left"
            title={isActive ? "当前使用" : "点击使用此模型"}
          >
            {m.provider === "mock" ? (
              <Sparkles className="size-4 shrink-0 text-cyber-amber" />
            ) : isActive ? (
              <CheckCircle2 className="size-4 shrink-0 text-cyber-cyan" />
            ) : configured ? (
              <Circle className="size-3 shrink-0 fill-cyber-lime/20 text-cyber-lime" />
            ) : (
              <Circle className="size-3 shrink-0 text-cyber-muted/50" />
            )}
            <span className="truncate text-xs font-medium text-cyber-text">{m.label}</span>
            {m.custom && <span className="shrink-0 text-[10px] text-cyber-lime/70">✦</span>}
            {configured && !isActive && m.provider !== "mock" && (
              <span className="shrink-0 rounded bg-cyber-lime/10 px-1 text-[9px] text-cyber-lime">
                已配置
              </span>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-1">
            {m.provider === "mock" && (
              <span className="rounded bg-cyber-amber/10 px-1.5 py-0.5 text-[9px] text-cyber-amber">
                免配置
              </span>
            )}
            {isLoggedIn && configured && serverCfg && (
              <span className="font-mono text-[9px] text-cyber-cyan/70">
                {serverCfg.apiKeyMasked}
              </span>
            )}
            {!isLoggedIn && configured && m.provider !== "mock" && (
              <span className="font-mono text-[9px] text-cyber-muted">本地已存</span>
            )}
            {m.custom && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(m);
                  }}
                  className="rounded p-1 text-cyber-muted opacity-60 transition-opacity hover:text-cyber-cyan hover:opacity-100"
                  title="编辑"
                >
                  <Edit3 className="size-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustomModel(m.id);
                  }}
                  className="rounded p-1 text-cyber-muted opacity-60 transition-opacity hover:text-cyber-danger hover:opacity-100"
                  title="删除"
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            )}
            {m.provider !== "mock" && (
              <button
                onClick={() => toggleExpand(m.id, m)}
                className="rounded p-1 text-cyber-muted transition-colors hover:text-cyber-cyan"
                title={state.expanded ? "收起" : "配置 Key"}
              >
                {state.expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {state.expanded && m.provider !== "mock" && (
          <div className="space-y-2.5 border-t border-cyber-border/40 px-3 pb-3 pt-3">
            <div className="flex items-center gap-2 text-[10px] text-cyber-muted">
              {isLoggedIn ? (
                <>
                  <Database className="size-3 text-cyber-cyan" /> Key 将加密存储到数据库
                </>
              ) : (
                <>
                  <HardDrive className="size-3 text-cyber-amber" /> Key
                  保存在浏览器本地，登录后可加密存储到数据库
                </>
              )}
              {vendorLink && (
                <a
                  href={vendorLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-0.5 text-cyber-cyan hover:underline"
                >
                  获取 Key <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] text-cyber-muted">Base URL</label>
              <input
                type="text"
                value={state.baseUrl}
                onChange={(e) => updateCardState(m.id, m, { baseUrl: e.target.value })}
                placeholder={m.baseUrl || "https://api.example.com/v1"}
                className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-2.5 py-1.5 text-xs text-cyber-text placeholder:text-cyber-muted/40 focus:border-cyber-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] text-cyber-muted">API Key</label>
              <div className="relative">
                <input
                  type={state.revealKey ? "text" : "password"}
                  value={state.apiKey}
                  onChange={(e) => updateCardState(m.id, m, { apiKey: e.target.value })}
                  placeholder={
                    configured
                      ? isLoggedIn
                        ? "输入新 Key 以覆盖"
                        : "••••••••••••"
                      : getKeyPlaceholder(m.vendor)
                  }
                  className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-2.5 py-1.5 pr-8 text-xs text-cyber-text placeholder:text-cyber-muted/40 focus:border-cyber-cyan focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => updateCardState(m.id, m, { revealKey: !state.revealKey })}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-cyber-muted hover:text-cyber-cyan"
                >
                  {state.revealKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-[10px] text-cyber-muted">
                <span>温度</span>
                <span className="font-mono text-cyber-cyan">{state.temperature.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={state.temperature}
                onChange={(e) => updateCardState(m.id, m, { temperature: Number(e.target.value) })}
                className="w-full accent-cyber-cyan"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-cyber-muted/60">
                <span>精准 0.0</span>
                <span>平衡 1.0</span>
                <span>发散 2.0</span>
              </div>
            </div>

            {state.testResult && (
              <div
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] ${
                  state.testResult.ok
                    ? "bg-cyber-lime/10 text-cyber-lime"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {state.testResult.ok ? (
                  <Check className="size-3" />
                ) : (
                  <AlertCircle className="size-3" />
                )}
                {state.testResult.msg}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleSaveKey(m.id, m)}
                disabled={!state.apiKey.trim() || state.saving}
                className="flex items-center gap-1 rounded bg-cyber-cyan/20 px-2.5 py-1.5 text-[11px] text-cyber-cyan transition-colors hover:bg-cyber-cyan/30 disabled:opacity-40"
              >
                {state.saving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Save className="size-3" />
                )}
                保存 Key
              </button>
              <button
                onClick={() => handleTestKey(m.id, m)}
                disabled={state.testing}
                className="flex items-center gap-1 rounded bg-cyber-purple/20 px-2.5 py-1.5 text-[11px] text-cyber-purple transition-colors hover:bg-cyber-purple/30 disabled:opacity-40"
              >
                {state.testing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Zap className="size-3" />
                )}
                测试连接
              </button>
              {configured && (
                <button
                  onClick={() => handleClearKey(m.id, m)}
                  disabled={state.saving}
                  className="ml-auto flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-cyber-muted transition-colors hover:text-cyber-danger"
                >
                  <Trash2 className="size-3" />
                  清除
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-xs text-cyber-muted transition-colors hover:text-cyber-cyan"
        >
          ← 返回对话
        </a>

        <header className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-cyber-cyan/30 bg-cyber-surface/60">
            <SettingsIcon className="size-5 text-cyber-cyan" />
          </div>
          <div>
            <h1 className="text-gradient font-display text-2xl font-semibold">设置</h1>
            <p className="text-xs text-cyber-muted">配置账户、模型 API Key 与主题。</p>
          </div>
        </header>

        <div className="space-y-6">
          {authUser ? (
            <>
              <section className="glass rounded-xl border-cyber-border p-5">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                  <User className="size-4 text-cyber-cyan" />
                  账户信息
                </h2>
                <p className="mb-4 text-xs text-cyber-muted">管理您的个人资料和密码。</p>

                <div className="mb-4 rounded-lg border border-cyber-border/60 bg-cyber-bg/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-cyber-cyan/20">
                      <User className="size-5 text-cyber-cyan" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-cyber-text">
                          {authUser.name || authUser.email}
                        </span>
                        {authUser.role === "admin" && (
                          <span className="rounded bg-cyber-purple/20 px-1.5 py-0.5 text-[10px] text-cyber-purple">
                            管理员
                          </span>
                        )}
                        {authUser.emailVerified ? (
                          <span className="rounded bg-cyber-lime/20 px-1.5 py-0.5 text-[10px] text-cyber-lime">
                            已验证
                          </span>
                        ) : (
                          <span className="rounded bg-cyber-amber/20 px-1.5 py-0.5 text-[10px] text-cyber-amber">
                            未验证
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-cyber-muted">
                        <Mail className="size-3" />
                        {authUser.email}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label="昵称">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="输入昵称"
                        className="flex-1 rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                      />
                      <button
                        onClick={handleUpdateProfile}
                        className="rounded-md bg-cyber-cyan/20 px-3 py-2 text-xs text-cyber-cyan hover:bg-cyber-cyan/30"
                      >
                        保存
                      </button>
                    </div>
                  </Field>
                  {profileMsg && (
                    <div
                      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${
                        profileMsg.type === "success"
                          ? "bg-cyber-lime/10 text-cyber-lime"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {profileMsg.type === "success" ? (
                        <Check className="size-3" />
                      ) : (
                        <AlertCircle className="size-3" />
                      )}
                      {profileMsg.text}
                    </div>
                  )}
                  {!authUser.provider && (
                    <div className="border-t border-cyber-border/60 pt-4">
                      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-cyber-text">
                        <Lock className="size-3.5 text-cyber-amber" />
                        修改密码
                      </h3>
                      <div className="space-y-2">
                        <input
                          type="password"
                          value={passwordForm.current}
                          onChange={(e) =>
                            setPasswordForm((f) => ({ ...f, current: e.target.value }))
                          }
                          placeholder="当前密码"
                          className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="password"
                            value={passwordForm.new}
                            onChange={(e) =>
                              setPasswordForm((f) => ({ ...f, new: e.target.value }))
                            }
                            placeholder="新密码（至少6位）"
                            className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                          />
                          <input
                            type="password"
                            value={passwordForm.confirm}
                            onChange={(e) =>
                              setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
                            }
                            placeholder="确认新密码"
                            className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleChangePassword}
                          className="rounded-md bg-cyber-amber/20 px-3 py-2 text-xs text-cyber-amber hover:bg-cyber-amber/30"
                        >
                          修改密码
                        </button>
                        {passwordMsg && (
                          <div
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${
                              passwordMsg.type === "success"
                                ? "bg-cyber-lime/10 text-cyber-lime"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {passwordMsg.type === "success" ? (
                              <Check className="size-3" />
                            ) : (
                              <AlertCircle className="size-3" />
                            )}
                            {passwordMsg.text}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="glass rounded-xl border-cyber-border p-5">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                  <KeyRound className="size-4 text-cyber-purple" />
                  API 密钥
                </h2>
                <p className="mb-4 text-xs text-cyber-muted">
                  管理用于 API 访问的密钥，密钥仅显示一次请妥善保存。
                </p>
                {createdKey && (
                  <div className="mb-4 rounded-lg border border-cyber-lime/30 bg-cyber-lime/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-cyber-lime">新密钥创建成功</span>
                      <button
                        onClick={() => setCreatedKey(null)}
                        className="text-cyber-muted hover:text-cyber-text"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-cyber-bg/60 px-2 py-1.5 font-mono text-xs text-cyber-text">
                        {createdKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className="flex items-center gap-1 rounded bg-cyber-cyan/20 px-2 py-1.5 text-xs text-cyber-cyan"
                      >
                        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {copied ? "已复制" : "复制"}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-cyber-amber">
                      请立即保存，此密钥不会再次显示！
                    </p>
                  </div>
                )}
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="密钥名称（如：我的应用）"
                    className="flex-1 rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                  />
                  <select
                    value={newKeyExpiry || ""}
                    onChange={(e) =>
                      setNewKeyExpiry(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="rounded-md border border-cyber-border bg-cyber-bg/60 px-2 py-2 text-xs text-cyber-text"
                  >
                    <option value="">永不过期</option>
                    <option value="30">30天</option>
                    <option value="90">90天</option>
                    <option value="365">365天</option>
                  </select>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim()}
                    className="flex items-center gap-1 rounded-md bg-cyber-cyan/20 px-3 py-2 text-xs text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-40"
                  >
                    <Plus className="size-3" />
                    创建
                  </button>
                </div>
                <div className="space-y-2">
                  {authApiKeys.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-cyber-border/60 p-6 text-center text-xs text-cyber-muted">
                      <Key className="mx-auto mb-2 size-6 opacity-50" />
                      暂无 API 密钥
                    </div>
                  ) : (
                    authApiKeys.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between rounded-lg border border-cyber-border/60 bg-cyber-bg/40 px-3 py-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-cyber-text">{k.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] ${
                                k.status === "active"
                                  ? "bg-cyber-lime/20 text-cyber-lime"
                                  : "bg-cyber-muted/20 text-cyber-muted"
                              }`}
                            >
                              {k.status === "active" ? "活跃" : "已吊销"}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-cyber-muted">
                            {k.prefix}...
                          </div>
                        </div>
                        {k.status === "active" && (
                          <button
                            onClick={() => authRevokeApiKey(k.id)}
                            className="rounded p-1 text-cyber-muted hover:text-cyber-danger"
                            title="吊销"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="glass rounded-xl border-cyber-border p-5 text-center">
              <User className="mx-auto mb-3 size-10 text-cyber-muted" />
              <p className="mb-4 text-sm text-cyber-text">您尚未登录</p>
              <p className="mb-3 text-xs text-cyber-muted">
                登录后 API Key 将加密存储到数据库，多设备安全同步
              </p>
              <a
                href="/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-cyber-cyan/20 px-4 py-2 text-xs text-cyber-cyan hover:bg-cyber-cyan/30"
              >
                登录 / 注册
              </a>
            </section>
          )}

          {authUser && authUser.role === "admin" && (
            <section className="glass rounded-xl border-cyber-border p-5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                <Shield className="size-4 text-cyber-purple" />
                管理员工具
              </h2>
              <p className="mb-4 text-xs text-cyber-muted">系统管理功能。</p>
              <a
                href="/admin/users"
                className="flex items-center justify-between rounded-lg border border-cyber-border/60 bg-cyber-bg/40 px-4 py-3 text-xs text-cyber-text hover:border-cyber-cyan/50 hover:bg-cyber-surface/60"
              >
                <div className="flex items-center gap-2">
                  <UserCog className="size-4 text-cyber-purple" />
                  <span>用户管理</span>
                </div>
                <span className="text-cyber-muted">→</span>
              </a>
            </section>
          )}

          <section className="glass rounded-xl border-cyber-border p-5">
            <h2 className="mb-1 text-sm font-semibold text-cyber-text">主题</h2>
            <p className="mb-4 text-xs text-cyber-muted">选择界面主题风格。</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setTheme("cyber-dark")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "cyber-dark"
                    ? "border-cyber-cyan bg-cyber-cyan/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-cyber-cyan/50"
                }`}
              >
                <Moon className="size-4 text-cyber-cyan" />
                <div>
                  <div className="font-medium text-cyber-text">赛博深色</div>
                  <div className="text-[10px] text-cyber-muted">默认深色主题</div>
                </div>
              </button>
              <button
                onClick={() => setTheme("cyber-light")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "cyber-light"
                    ? "border-cyber-cyan bg-cyber-cyan/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-cyber-cyan/50"
                }`}
              >
                <Sun className="size-4 text-cyber-amber" />
                <div>
                  <div className="font-medium text-cyber-text">赛博亮色</div>
                  <div className="text-[10px] text-cyber-muted">浅色主题</div>
                </div>
              </button>
              <button
                onClick={() => setTheme("ocean")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "ocean"
                    ? "border-blue-400 bg-blue-400/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-blue-400/50"
                }`}
              >
                <div className="size-4 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
                <div>
                  <div className="font-medium text-cyber-text">海洋</div>
                  <div className="text-[10px] text-cyber-muted">深蓝海洋风格</div>
                </div>
              </button>
              <button
                onClick={() => setTheme("forest")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "forest"
                    ? "border-green-400 bg-green-400/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-green-400/50"
                }`}
              >
                <div className="size-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600" />
                <div>
                  <div className="font-medium text-cyber-text">森林</div>
                  <div className="text-[10px] text-cyber-muted">自然绿色风格</div>
                </div>
              </button>
              <button
                onClick={() => setTheme("sunset")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "sunset"
                    ? "border-orange-400 bg-orange-400/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-orange-400/50"
                }`}
              >
                <div className="size-4 rounded-full bg-gradient-to-br from-orange-400 to-rose-500" />
                <div>
                  <div className="font-medium text-cyber-text">日落</div>
                  <div className="text-[10px] text-cyber-muted">温暖橙红风格</div>
                </div>
              </button>
              <button
                onClick={() => setTheme("midnight")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                  theme === "midnight"
                    ? "border-purple-400 bg-purple-400/5 shadow-neon"
                    : "border-cyber-border bg-cyber-surface/40 hover:border-purple-400/50"
                }`}
              >
                <div className="size-4 rounded-full bg-gradient-to-br from-purple-400 to-violet-600" />
                <div>
                  <div className="font-medium text-cyber-text">午夜</div>
                  <div className="text-[10px] text-cyber-muted">深紫神秘风格</div>
                </div>
              </button>
            </div>
          </section>

          <section className="glass rounded-xl border-cyber-border p-5">
            <div>
              <h2 className="text-sm font-semibold text-cyber-text">默认温度</h2>
              <p className="mt-0.5 text-xs text-cyber-muted">
                模型默认温度，可在每个模型的配置中单独覆盖。
              </p>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-cyber-muted">
                <span>温度</span>
                <span className="font-mono text-cyber-cyan">{globalTemp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={globalTemp}
                onChange={(e) => setGlobalTemp(Number(e.target.value))}
                className="w-full accent-cyber-cyan"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-cyber-muted/60">
                <span>精准 0.0</span>
                <span>平衡 1.0</span>
                <span>发散 2.0</span>
              </div>
            </div>
          </section>

          <section className="glass rounded-xl border-cyber-border p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-cyber-text">模型</h2>
                <p className="mt-0.5 text-xs text-cyber-muted">
                  每个模型可独立配置 API Key。
                  {isLoggedIn ? "🔒 Key 已 AES-256 加密存储" : "💡 登录后可加密存储到数据库"}
                </p>
              </div>
              <button
                onClick={() => {
                  resetCustomForm();
                  setShowAddForm(true);
                  setCustomReveal(true);
                }}
                className="flex items-center gap-1 rounded-md border border-dashed border-cyber-border px-2.5 py-1.5 text-[11px] text-cyber-muted hover:border-cyber-cyan hover:text-cyber-cyan"
              >
                <Plus className="size-3.5" />
                添加自定义
              </button>
            </div>

            {serverLoading && (
              <div className="mb-3 flex items-center gap-2 text-[10px] text-cyber-muted">
                <Loader2 className="size-3 animate-spin" />
                从服务器加载配置...
              </div>
            )}

            {showAddForm && (
              <div className="mb-4 rounded-lg border border-cyber-cyan/30 bg-cyber-cyan/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyber-cyan">
                    {editingId ? "编辑自定义模型" : "添加自定义模型"}
                  </span>
                  <button
                    onClick={resetCustomForm}
                    className="text-cyber-muted hover:text-cyber-text"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="显示名称 *">
                    <input
                      type="text"
                      value={customForm.label}
                      onChange={(e) => setCustomForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="例如：我的本地模型"
                      className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                    />
                  </Field>
                  <Field label="厂商/分组">
                    <input
                      type="text"
                      value={customForm.vendor}
                      onChange={(e) => setCustomForm((f) => ({ ...f, vendor: e.target.value }))}
                      placeholder="自定义"
                      className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                    />
                  </Field>
                  <Field label="模型 ID *">
                    <input
                      type="text"
                      value={customForm.modelId}
                      onChange={(e) => setCustomForm((f) => ({ ...f, modelId: e.target.value }))}
                      placeholder="例如：qwen2.5-7b-instruct"
                      className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                    />
                  </Field>
                  <Field label="Base URL *">
                    <input
                      type="text"
                      value={customForm.baseUrl}
                      onChange={(e) => setCustomForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="API Key">
                      <div className="relative">
                        <input
                          type={customReveal ? "text" : "password"}
                          value={customForm.apiKey}
                          onChange={(e) => setCustomForm((f) => ({ ...f, apiKey: e.target.value }))}
                          placeholder="输入 API Key（可选，也可添加后再配置）"
                          className="w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 pr-10 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomReveal((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-cyber-muted hover:text-cyber-cyan"
                        >
                          {customReveal ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={resetCustomForm}
                    className="rounded-md px-3 py-1.5 text-xs text-cyber-muted hover:text-cyber-text"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveCustomModel}
                    disabled={
                      !customForm.label.trim() ||
                      !customForm.modelId.trim() ||
                      !customForm.baseUrl.trim()
                    }
                    className="flex items-center gap-1 rounded-md bg-cyber-cyan/20 px-3 py-1.5 text-xs text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-40"
                  >
                    <Save className="size-3.5" />
                    {editingId ? "保存修改" : "添加"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {modelGroups.map((group) => (
                <div key={group.vendor}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-cyber-muted">
                      {group.vendor}
                    </span>
                    {VENDOR_LINKS[group.vendor] && (
                      <a
                        href={VENDOR_LINKS[group.vendor].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-[10px] text-cyber-cyan/70 hover:text-cyber-cyan"
                      >
                        {VENDOR_LINKS[group.vendor].name} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.models.map((m) => renderModelCard(m))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between">
            <button
              onClick={() => resetSettings()}
              className="flex items-center gap-1.5 text-xs text-cyber-muted hover:text-cyber-danger"
            >
              <RotateCcw className="size-3" />
              恢复默认
            </button>
            <button
              onClick={saveGeneralSettings}
              className="btn-glow flex items-center gap-2 rounded-md bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-magenta px-4 py-2 text-sm text-white shadow-neon hover:scale-[1.02]"
            >
              {saved ? (
                <>
                  <Save className="size-4" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  保存设置
                </>
              )}
            </button>
          </div>

          {authUser && (
            <section className="glass rounded-xl border-cyber-border p-5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyber-danger/30 bg-cyber-danger/5 py-2.5 text-xs text-cyber-danger hover:bg-cyber-danger/10"
              >
                <LogOut className="size-4" />
                退出登录
              </button>
            </section>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-cyber-muted/60">
          NEXUS · 模型配置加密存储 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
