import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";

const PRIORITY_COLOR: Record<string,string> = { low:"#16a34a", medium:"#d97706", high:"#dc2626" };

export default function PunchListScreen() {
  const [items, setItems]   = useState<any[]>([]);
  const [filter, setFilter] = useState<"open"|"mine"|"done">("open");
  const [userId, setUserId] = useState<string|null>(null);
  const [checking, setChecking] = useState<string|null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("punch_list_items")
      .select("*, projects(name)").order("priority").order("created_at", { ascending:false });
    setItems(data ?? []);
  };

  const toggle = async (item: any) => {
    setChecking(item.id);
    const newStatus = item.status === "open" ? "completed" : "open";
    await supabase.from("punch_list_items").update({
      status: newStatus,
      completed_date: newStatus === "completed" ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", item.id);
    await load();
    setChecking(null);
  };

  const startItem = async (id: string) => {
    await supabase.from("punch_list_items").update({ status:"in_progress" }).eq("id", id);
    await load();
  };

  const filtered = items.filter(i => {
    if (filter === "open")  return i.status === "open" || i.status === "in_progress";
    if (filter === "done")  return i.status === "completed" || i.status === "verified";
    return true;
  });

  const openCount = items.filter(i => i.status === "open" || i.status === "in_progress").length;
  const doneCount = items.filter(i => i.status === "completed" || i.status === "verified").length;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>Punch List</Text>
        <Text style={s.sub}>{openCount} open · {doneCount} completed</Text>
      </View>

      {/* Filter tabs */}
      <View style={{ flexDirection:"row", gap:8, paddingHorizontal:16, marginBottom:12 }}>
        {(["open","done"] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[s.filterBtn, filter===f && s.filterBtnActive]}>
            <Text style={[s.filterText, filter===f && s.filterTextActive]}>
              {f === "open" ? `Open (${openCount})` : `Done (${doneCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal:16 }}>
        {filtered.length === 0 ? (
          <View style={{ alignItems:"center", padding:40 }}>
            <Text style={{ fontSize:36, marginBottom:12 }}>{filter==="open" ? "✅" : "📋"}</Text>
            <Text style={{ color:"#6b7280", fontWeight:"600", fontSize:15 }}>
              {filter==="open" ? "No open items — great job!" : "Nothing completed yet"}
            </Text>
          </View>
        ) : filtered.map(item => {
          const isChecking = checking === item.id;
          const isDone = item.status === "completed" || item.status === "verified";
          const pc = PRIORITY_COLOR[item.priority] ?? "#6b7280";
          return (
            <View key={item.id} style={[s.card, isDone && s.cardDone]}>
              <View style={{ flexDirection:"row", alignItems:"flex-start", gap:12 }}>
                {/* Checkbox */}
                <TouchableOpacity onPress={() => toggle(item)} disabled={isChecking}
                  style={[s.checkbox, isDone && s.checkboxDone]}>
                  {isDone && <Text style={{ color:"#fff", fontSize:13, fontWeight:"900" }}>✓</Text>}
                </TouchableOpacity>

                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:"row", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                    <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:5, backgroundColor:pc+"18" }}>
                      <Text style={{ fontSize:10, fontWeight:"700", color:pc, textTransform:"uppercase" }}>{item.priority}</Text>
                    </View>
                    {item.status === "in_progress" && (
                      <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:5, backgroundColor:"#dbeafe" }}>
                        <Text style={{ fontSize:10, fontWeight:"700", color:"#2563eb" }}>IN PROGRESS</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.itemTitle, isDone && s.itemTitleDone]}>{item.title}</Text>
                  <Text style={s.itemMeta}>
                    {item.projects?.name}
                    {item.location ? ` · ${item.location}` : ""}
                    {item.assigned_to ? ` · ${item.assigned_to}` : ""}
                  </Text>
                  {item.due_date && (
                    <Text style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Due: {item.due_date}</Text>
                  )}
                </View>

                {/* Start button for open items */}
                {item.status === "open" && (
                  <TouchableOpacity onPress={() => startItem(item.id)}
                    style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:"#e5e7eb" }}>
                    <Text style={{ fontSize:11, fontWeight:"700", color:"#6b7280" }}>Start</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex:1, backgroundColor:"#f9fafb" },
  header:          { padding:20, paddingTop:60 },
  title:           { fontSize:24, fontWeight:"800", color:"#111827" },
  sub:             { fontSize:13, color:"#6b7280", marginTop:4 },
  filterBtn:       { flex:1, paddingVertical:9, borderRadius:10, borderWidth:1, borderColor:"#e5e7eb", backgroundColor:"#fff", alignItems:"center" },
  filterBtnActive: { backgroundColor:"#f97316", borderColor:"#f97316" },
  filterText:      { fontSize:13, fontWeight:"600", color:"#6b7280" },
  filterTextActive:{ color:"#fff" },
  card:            { backgroundColor:"#fff", borderRadius:14, borderWidth:1, borderColor:"#e5e7eb", marginBottom:10, padding:14 },
  cardDone:        { opacity:0.65 },
  checkbox:        { width:26, height:26, borderRadius:8, borderWidth:2, borderColor:"#d1d5db", alignItems:"center", justifyContent:"center", marginTop:2, flexShrink:0 },
  checkboxDone:    { backgroundColor:"#16a34a", borderColor:"#16a34a" },
  itemTitle:       { fontSize:14, fontWeight:"600", color:"#111827" },
  itemTitleDone:   { textDecorationLine:"line-through", color:"#9ca3af" },
  itemMeta:        { fontSize:12, color:"#6b7280", marginTop:2 },
});
