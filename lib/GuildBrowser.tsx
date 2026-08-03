import type { GuildSummary } from "./guilds";

// A list of every server the plugin can act in, each with an on/off toggle.
// Servers are ON by default — the stored set is an *exclusion* list, so a
// newly joined server is covered without the user touching anything.
//
// As with SettingsList, nothing here may run at module-load time: every host
// lookup happens lazily inside the render.

export interface GuildBrowserOptions {
  list: () => GuildSummary[];
  isExcluded: (guildId: string) => boolean;
  setExcluded: (guildId: string, excluded: boolean) => void;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  let out = "";
  for (let i = 0; i < words.length && out.length < 2; i++) out += words[i][0];
  return out.toUpperCase() || "?";
}

export function createGuildBrowser(options: GuildBrowserOptions) {
  return function GuildBrowser() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { View, Text, TouchableOpacity, Image, TextInput } = RN;

    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const [query, setQuery] = React.useState("");
    const [expanded, setExpanded] = React.useState(false);

    // Recomputed per render: joining or leaving a server, or a role change,
    // should be reflected without reopening the screen.
    const all = options.list();
    const needle = query.trim().toLowerCase();
    const shown = needle ? all.filter(g => g.name.toLowerCase().indexOf(needle) !== -1) : all;
    const offCount = all.filter(g => options.isExcluded(g.id)).length;

    const toggle = (id: string) => {
      options.setExcluded(id, !options.isExcluded(id));
      forceUpdate();
    };

    const header = (
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#2b2d31",
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
        }}
      >
        <View>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Servers</Text>
          <Text style={{ color: "#b5bac1", fontSize: 13 }}>
            {all.length === 0
              ? "None you can time members out in"
              : offCount === 0
                ? `All ${all.length} — tap to choose`
                : `${all.length - offCount} of ${all.length} on — tap to choose`}
          </Text>
        </View>
        <Text style={{ color: "#b5bac1", fontSize: 18 }}>{expanded ? "▾" : "▸"}</Text>
      </TouchableOpacity>
    );

    if (!expanded || all.length === 0) return <View>{header}</View>;

    return (
      <View>
        {header}
        {all.length > 8 ? (
          <TextInput
            style={{
              color: "#fff",
              backgroundColor: "#1e1f22",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 8,
              fontSize: 15,
            }}
            value={query}
            onChangeText={setQuery}
            placeholder="Search servers"
            placeholderTextColor="#6d6f78"
          />
        ) : null}

        {shown.map(g => {
          const on = !options.isExcluded(g.id);
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => toggle(g.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1e1f22",
                borderRadius: 8,
                padding: 10,
                marginBottom: 6,
                opacity: on ? 1 : 0.45,
              }}
            >
              {g.icon ? (
                <Image
                  source={{
                    uri: `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`,
                  }}
                  style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }}
                />
              ) : (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    marginRight: 10,
                    backgroundColor: "#4e5058",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                    {initials(g.name)}
                  </Text>
                </View>
              )}
              <Text style={{ color: "#fff", fontSize: 15, flex: 1 }} numberOfLines={1}>
                {g.name}
              </Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: on ? "#248046" : "#4e5058",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                  {on ? "ON" : "OFF"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {shown.length === 0 ? (
          <Text style={{ color: "#6d6f78", marginBottom: 8 }}>No servers match.</Text>
        ) : null}
      </View>
    );
  };
}
