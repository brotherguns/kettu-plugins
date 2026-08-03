import type { PluginStorage } from "../vendetta";
import type { Rule } from "./rules";

// IMPORTANT: nothing here may run at module-load time except pure declarations.
// A throw at load (e.g. destructuring a missing component) would stop the whole
// plugin from enabling. So every host lookup happens lazily inside the render.

export interface TextField {
  key: string;
  label: string;
  placeholder?: string;
  initial?: string;
}

export interface ChoiceField {
  key: string;
  label: string;
  choices: Array<{ value: string; label: string }>;
  initial: string;
}

export interface SettingsListOptions {
  // Extra per-rule inputs rendered after the two ID fields.
  fields?: TextField[];
  choice?: ChoiceField;
  // Secondary line shown under each saved rule. Defaults to the server id.
  describe?: (rule: Rule) => string;
}

// Settings screen for a plugin: user ID + server/guild ID inputs, any extra
// per-rule fields the plugin declares, and an "Add rule" button, followed by
// the current rule list. Tap a rule to remove it. Built only from guaranteed
// React Native primitives.
export function createSettingsList(options: SettingsListOptions = {}) {
  const fields = options.fields || [];
  const choice = options.choice;

  return function SettingsList() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { ScrollView, View, Text, TextInput, TouchableOpacity } = RN;

    const storage = vendetta.plugin.storage as PluginStorage;
    if (!storage.rules) storage.rules = [];

    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const [userId, setUserId] = React.useState("");
    const [guildId, setGuildId] = React.useState("");

    const initialExtras = () => {
      const seed: Record<string, string> = {};
      for (let i = 0; i < fields.length; i++) {
        seed[fields[i].key] = fields[i].initial || "";
      }
      if (choice) seed[choice.key] = choice.initial;
      return seed;
    };
    const [extras, setExtras] = React.useState(initialExtras);

    const setExtra = (key: string, value: string) =>
      setExtras((prev: Record<string, string>) => {
        const next = { ...prev };
        next[key] = value;
        return next;
      });

    const addRule = () => {
      if (!userId.trim() || !guildId.trim()) return;
      const rule: any = { userId: userId.trim(), guildId: guildId.trim() };
      for (let i = 0; i < fields.length; i++) {
        const key = fields[i].key;
        rule[key] = (extras[key] || fields[i].initial || "").trim();
      }
      if (choice) rule[choice.key] = extras[choice.key] || choice.initial;
      storage.rules.push(rule);
      setUserId("");
      setGuildId("");
      setExtras(initialExtras());
      forceUpdate();
    };

    const removeRule = (index: number) => {
      storage.rules.splice(index, 1);
      forceUpdate();
    };

    const describe = options.describe || ((rule: Rule) => `Server ${rule.guildId}`);

    const input = {
      color: "#fff",
      backgroundColor: "#1e1f22",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      fontSize: 16,
    } as const;
    const label = { color: "#b5bac1", fontSize: 13, marginBottom: 4 } as const;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={label}>User ID</Text>
        <TextInput
          style={input}
          value={userId}
          onChangeText={setUserId}
          placeholder="e.g. 877502759404974110"
          placeholderTextColor="#6d6f78"
          keyboardType="numeric"
        />
        <Text style={label}>Server (Guild) ID</Text>
        <TextInput
          style={input}
          value={guildId}
          onChangeText={setGuildId}
          placeholder="e.g. 1368145952266911755"
          placeholderTextColor="#6d6f78"
          keyboardType="numeric"
        />

        {choice ? (
          <View>
            <Text style={label}>{choice.label}</Text>
            <View style={{ flexDirection: "row", marginBottom: 10 }}>
              {choice.choices.map(opt => {
                const selected = (extras[choice.key] || choice.initial) === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setExtra(choice.key, opt.value)}
                    style={{
                      flex: 1,
                      backgroundColor: selected ? "#5865f2" : "#1e1f22",
                      borderRadius: 8,
                      paddingVertical: 10,
                      alignItems: "center",
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: selected ? "#fff" : "#b5bac1", fontSize: 14 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {fields.map(field => (
          <View key={field.key}>
            <Text style={label}>{field.label}</Text>
            <TextInput
              style={input}
              value={extras[field.key] || ""}
              onChangeText={(v: string) => setExtra(field.key, v)}
              placeholder={field.placeholder || ""}
              placeholderTextColor="#6d6f78"
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={addRule}
          style={{ backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Add rule</Text>
        </TouchableOpacity>

        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
          Rules ({storage.rules.length})
        </Text>
        {storage.rules.length === 0 ? (
          <Text style={{ color: "#6d6f78" }}>No rules yet. Add a User ID + Server ID above.</Text>
        ) : (
          storage.rules.map((rule, i) => (
            <TouchableOpacity
              key={`${rule.userId}-${rule.guildId}-${i}`}
              onPress={() => removeRule(i)}
              style={{ backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <Text style={{ color: "#fff", fontSize: 15 }}>User {rule.userId}</Text>
              <Text style={{ color: "#b5bac1", fontSize: 13 }}>
                {describe(rule)} — tap to remove
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };
}
