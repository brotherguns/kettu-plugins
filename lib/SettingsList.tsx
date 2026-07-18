import type { PluginStorage } from "../vendetta";

const { React, ReactNative } = vendetta.metro.common;
const { Forms } = vendetta.ui.components;
const { FormInput, FormRow, FormDivider, FormText } = Forms;
const { ScrollView, View } = ReactNative;

// Settings screen for a plugin: two inputs (user ID + server/guild ID) and an
// "Add rule" button, followed by the current rule list. Tap a rule to remove
// it. Mutations write straight to the persisted `storage` proxy; a local
// counter forces a re-render.
export function createSettingsList(storage: PluginStorage) {
  return function SettingsList() {
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

    return (
      <ScrollView style={{ flex: 1 }}>
        <FormInput
          title="User ID"
          value={userId}
          onChange={(v: string) => setUserId(v)}
          placeholder="e.g. 877502759404974110"
        />
        <FormInput
          title="Server (Guild) ID"
          value={guildId}
          onChange={(v: string) => setGuildId(v)}
          placeholder="e.g. 1368145952266911755"
        />
        <FormRow
          label="Add rule"
          subLabel="Adds the user + server pair above"
          onPress={addRule}
        />
        <FormDivider />
        {storage.rules.length === 0 ? (
          <View style={{ padding: 16 }}>
            <FormText>No rules yet. Add a User ID + Server ID above.</FormText>
          </View>
        ) : (
          storage.rules.map((rule, i) => (
            <FormRow
              key={`${rule.userId}-${rule.guildId}-${i}`}
              label={`User ${rule.userId}`}
              subLabel={`Server ${rule.guildId} — tap to remove`}
              onPress={() => removeRule(i)}
            />
          ))
        )}
      </ScrollView>
    );
  };
}
