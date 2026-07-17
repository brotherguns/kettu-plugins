import type { PluginStorage } from "../bunny";

const { React } = bunny.metro.common;

// Design-system components — confirm names via /eval (see note above).
const { TableRowGroup, TableRow, TextInput, Button, Stack } =
  bunny.metro.findByProps("TableRowGroup", "TableRow", "TextInput", "Button", "Stack");

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
      <Stack spacing={12} style={{ padding: 12 }}>
        <TextInput
          label="User ID"
          value={userId}
          onChange={setUserId}
          placeholder="e.g. 877502759404974110"
        />
        <TextInput
          label="Server (Guild) ID"
          value={guildId}
          onChange={setGuildId}
          placeholder="e.g. 1368145952266911755"
        />
        <Button text="Add rule" onPress={addRule} />
        <TableRowGroup title="Rules">
          {storage.rules.map((rule, i) => (
            <TableRow
              key={`${rule.userId}-${rule.guildId}-${i}`}
              label={`User ${rule.userId}`}
              subLabel={`Guild ${rule.guildId}`}
              trailing={<Button text="Remove" onPress={() => removeRule(i)} />}
            />
          ))}
        </TableRowGroup>
      </Stack>
    );
  };
}
