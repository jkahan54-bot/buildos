import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICON: Record<string, [IoniconName, IoniconName]> = {
  index:     ["sunny",           "sunny-outline"],
  timelog:   ["time",            "time-outline"],
  safety:    ["warning",         "warning-outline"],
  photos:    ["camera",          "camera-outline"],
  checklist: ["checkbox",        "checkbox-outline"],
  messages:  ["chatbubbles",     "chatbubbles-outline"],
};

const ORANGE = "#F46519";
const GRAY   = "#6B7280";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor:"#0E0E10", borderTopColor:"#222226", height:80, paddingBottom:16 },
      tabBarActiveTintColor: ORANGE,
      tabBarInactiveTintColor: GRAY,
      tabBarLabelStyle: { fontSize:10, fontWeight:"600" },
    }}>
      <Tabs.Screen name="index"     options={{ title:"My Day",    tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.index[0]     : TAB_ICON.index[1]}     size={24} color={color} /> }} />
      <Tabs.Screen name="timelog"   options={{ title:"Time",      tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.timelog[0]   : TAB_ICON.timelog[1]}   size={24} color={color} /> }} />
      <Tabs.Screen name="safety"    options={{ title:"Safety",    tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.safety[0]    : TAB_ICON.safety[1]}    size={24} color={color} /> }} />
      <Tabs.Screen name="photos"    options={{ title:"Photos",    tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.photos[0]    : TAB_ICON.photos[1]}    size={24} color={color} /> }} />
      <Tabs.Screen name="checklist" options={{ title:"Checklist", tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.checklist[0] : TAB_ICON.checklist[1]} size={24} color={color} /> }} />
      <Tabs.Screen name="messages"  options={{ title:"Messages",  tabBarIcon:({ focused, color }) => <Ionicons name={focused ? TAB_ICON.messages[0]  : TAB_ICON.messages[1]}  size={24} color={color} /> }} />
    </Tabs>
  );
}
