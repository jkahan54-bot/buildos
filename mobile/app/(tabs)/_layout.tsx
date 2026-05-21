import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const ORANGE = "#F46519";
const GRAY   = "#6B7280";

// Field worker tabs — most used first, then extras
const TABS: { name: string; label: string; icon: [IoniconName, IoniconName] }[] = [
  { name:"index",    label:"My Day",     icon:["sunny",         "sunny-outline"]         },
  { name:"timelog",  label:"Time",       icon:["time",          "time-outline"]          },
  { name:"dailylog", label:"Daily Log",  icon:["calendar",      "calendar-outline"]      },
  { name:"safety",   label:"Safety",     icon:["warning",       "warning-outline"]       },
  { name:"punchlist",label:"Punch List", icon:["checkbox",      "checkbox-outline"]      },
  { name:"rfis",     label:"RFIs",       icon:["help-circle",   "help-circle-outline"]   },
  { name:"photos",   label:"Photos",     icon:["camera",        "camera-outline"]        },
  { name:"checklist",label:"Checklist",  icon:["list",          "list-outline"]          },
  { name:"messages", label:"Messages",   icon:["chatbubbles",   "chatbubbles-outline"]   },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:"#ffffff",
          borderTopColor:"#e5e7eb",
          borderTopWidth:1,
          height:80,
          paddingBottom:16,
          paddingTop:4,
        },
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: GRAY,
        tabBarLabelStyle: { fontSize:10, fontWeight:"600" },
        tabBarScrollEnabled: true,   // allows scrolling through tabs
        tabBarItemStyle: { minWidth:70 },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.icon[0] : tab.icon[1]}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
