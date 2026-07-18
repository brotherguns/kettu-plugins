import type { PluginStorage } from "../vendetta";

// IMPORTANT: nothing here may run at module-load time except pure declarations.
// A throw at load (e.g. destructuring a missing component) would stop the whole
// plugin from enabling. So every host lookup happens lazily inside the render.

// Settings screen for a plugin: two inputs (user ID + server/guild ID) and an
// "Add rule" button, followed by the current rule list. Tap a rule to remove
// it. Built only from guaranteed React Native primitives.
export function createSettingsList(storage: PluginStorage) {
  return function SettingsList() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { ScrollView, View, Text, TextInput, TouchableOpacity } = RN;

    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const [userId, setUserId] = React.useState("");
    const [guildId, setGuildId] = React.useState("");

    const addRule = () => {
      if (!userId.trim() || !guildId.trim()) return;
      storage.rules.push({ userId: userId.trim(), guildId: guildId.trim() });
      setUserId("");
      setGuildId("");
      forceUpdate();
    };

    const removeRule = (index: number) => {
      storage.rules.splice(index, 1);
      forceUpdate();
    };

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
                Server {rule.guildId} — tap to remove
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };
}
