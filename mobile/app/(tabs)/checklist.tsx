import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";
import { supabase } from "../../lib/supabase";

export default function ChecklistScreen() {
  const [projects, setProjects]     = useState<any[]>([]);
  const [selectedProj, setSelected] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [activeList, setActiveList] = useState<any>(null);
  const [items, setItems]           = useState<any[]>([]);
  const [search, setSearch]         = useState("");
  const [filterUnchecked, setFilter]= useState(false);
  const [loading, setLoading]       = useState(false);

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selectedProj) loadChecklists(selectedProj.id); }, [selectedProj]);
  useEffect(() => { if (activeList) loadItems(activeList.id); }, [activeList]);

  const loadProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, type").eq("type","medical_facility").order("created_at", { ascending:false });
    setProjects(data ?? []);
    // Also show standard projects
    const { data: all } = await supabase.from("projects").select("id, name, type").order("created_at", { ascending:false });
    setProjects(all ?? []);
  };

  const loadChecklists = async (projectId: string) => {
    const { data } = await supabase.from("medical_checklists").select("*").eq("project_id", projectId).order("created_at");
    setChecklists(data ?? []);
    setActiveList(null);
    setItems([]);
  };

  const loadItems = async (checklistId: string) => {
    const { data } = await supabase.from("medical_checklist_items").select("*, profiles(full_name)").eq("checklist_id", checklistId).order("category, product_name");
    setItems(data ?? []);
  };

  const toggleItem = async (item: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newVal = !item.checked;
    await supabase.from("medical_checklist_items").update({
      checked: newVal,
      checked_by: newVal ? user!.id : null,
      checked_at: newVal ? new Date().toISOString() : null,
    }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked:newVal } : i));
  };

  const toggleModified = async (item: any) => {
    const newVal = !item.modified;
    await supabase.from("medical_checklist_items").update({ modified:newVal }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, modified:newVal } : i));
  };

  const filteredItems = items.filter(i => {
    const matchSearch = !search || i.product_name?.toLowerCase().includes(search.toLowerCase()) || i.category?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filterUnchecked || !i.checked;
    return matchSearch && matchFilter;
  });

  const categories = [...new Set(filteredItems.map(i => i.category ?? "General"))];
  const checkedCount = items.filter(i => i.checked).length;
  const progress = items.length > 0 ? Math.round(checkedCount / items.length * 100) : 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>Medical Checklist</Text>
        <Text style={s.sub}>Field installation checklist</Text>
      </View>

      {/* Project selector */}
      {!selectedProj ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Select Project</Text>
          {projects.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏥</Text>
              <Text style={s.emptyText}>No projects yet</Text>
              <Text style={s.emptyHint}>Create a Medical Facility project on the web portal</Text>
            </View>
          ) : projects.map(p => (
            <TouchableOpacity key={p.id} style={s.projCard} onPress={() => setSelected(p)}>
              <View>
                <Text style={s.projName}>{p.name}</Text>
                {p.type === "medical_facility" && <Text style={s.medicalTag}>🏥 Medical Facility</Text>}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : !activeList ? (
        <View style={s.section}>
          <TouchableOpacity style={s.backBtn} onPress={() => { setSelected(null); setChecklists([]); }}>
            <Text style={s.backText}>‹ Back to Projects</Text>
          </TouchableOpacity>
          <Text style={s.sectionTitle}>{selectedProj.name}</Text>
          {checklists.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyText}>No checklists yet</Text>
              <Text style={s.emptyHint}>Import from Excel on the web portal to create checklists for this project</Text>
            </View>
          ) : checklists.map(cl => (
            <TouchableOpacity key={cl.id} style={s.listCard} onPress={() => setActiveList(cl)}>
              <View>
                <Text style={s.listName}>{cl.name}</Text>
                {cl.room_type && <Text style={s.roomType}>{cl.room_type}</Text>}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ flex:1 }}>
          <View style={s.section}>
            <TouchableOpacity style={s.backBtn} onPress={() => setActiveList(null)}>
              <Text style={s.backText}>‹ Back to Checklists</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>{activeList.name}</Text>

            {/* Progress */}
            <View style={s.progressCard}>
              <View style={s.progressRow}>
                <Text style={s.progressText}>{checkedCount} / {items.length} installed</Text>
                <Text style={[s.progressPct, { color: progress === 100 ? "#22C55E" : "#F46519" }]}>{progress}%</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width:`${progress}%` as any, backgroundColor: progress === 100 ? "#22C55E" : "#F46519" }]} />
              </View>
            </View>

            {/* Filters */}
            <View style={s.filterRow}>
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search items..." placeholderTextColor="#555" />
              <TouchableOpacity style={[s.filterBtn, filterUnchecked && s.filterActive]} onPress={() => setFilter(!filterUnchecked)}>
                <Text style={[s.filterText, filterUnchecked && { color:"#F46519" }]}>Remaining</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Items by category */}
          {categories.map(cat => (
            <View key={cat}>
              <Text style={s.catHeader}>{cat}</Text>
              {filteredItems.filter(i => (i.category ?? "General") === cat).map(item => (
                <View key={item.id} style={[s.itemCard, item.checked && s.itemChecked]}>
                  <TouchableOpacity style={s.checkbox} onPress={() => toggleItem(item)}>
                    <View style={[s.checkboxInner, item.checked && s.checkboxChecked]}>
                      {item.checked && <Text style={s.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <View style={s.itemInfo}>
                    <Text style={[s.itemName, item.checked && s.itemNameChecked]} numberOfLines={2}>{item.product_name}</Text>
                    {item.product_code && <Text style={s.itemCode}>#{item.product_code}</Text>}
                    <View style={s.itemMeta}>
                      <Text style={s.itemQty}>Qty: {item.quantity_installed ?? 0}/{item.quantity_needed ?? 1}</Text>
                      {item.checked && item.profiles?.full_name && (
                        <Text style={s.checkedBy}>✓ {item.profiles.full_name.split(" ")[0]}</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={[s.modBtn, item.modified && s.modBtnActive]} onPress={() => toggleModified(item)}>
                    <Text style={[s.modText, item.modified && { color:"#F59E0B" }]}>MOD</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:      { flex:1, backgroundColor:"#08080A" },
  header:         { padding:24, paddingTop:60 },
  title:          { fontSize:28, fontWeight:"900", color:"#F5F5F5" },
  sub:            { fontSize:13, color:"#6B7280", marginTop:4 },
  section:        { paddingHorizontal:24, marginBottom:8 },
  sectionTitle:   { fontSize:18, fontWeight:"800", color:"#F5F5F5", marginBottom:14 },
  backBtn:        { marginBottom:16 },
  backText:       { color:"#F46519", fontSize:14, fontWeight:"600" },
  projCard:       { backgroundColor:"#0E0E10", borderRadius:14, padding:18, borderWidth:1, borderColor:"#222226", marginBottom:10, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  projName:       { fontSize:15, fontWeight:"700", color:"#F5F5F5" },
  medicalTag:     { fontSize:12, color:"#A855F7", marginTop:4 },
  listCard:       { backgroundColor:"#0E0E10", borderRadius:14, padding:18, borderWidth:1, borderColor:"#222226", marginBottom:10, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  listName:       { fontSize:15, fontWeight:"700", color:"#F5F5F5" },
  roomType:       { fontSize:12, color:"#6B7280", marginTop:4 },
  chevron:        { fontSize:24, color:"#6B7280" },
  empty:          { backgroundColor:"#0E0E10", borderRadius:16, padding:40, alignItems:"center", borderWidth:1, borderColor:"#222226", borderStyle:"dashed" },
  emptyIcon:      { fontSize:40, marginBottom:12 },
  emptyText:      { color:"#6B7280", fontSize:15, fontWeight:"600" },
  emptyHint:      { color:"#374151", fontSize:12, marginTop:8, textAlign:"center" },
  progressCard:   { backgroundColor:"#0E0E10", borderRadius:14, padding:16, borderWidth:1, borderColor:"#222226", marginBottom:14 },
  progressRow:    { flexDirection:"row", justifyContent:"space-between", marginBottom:10 },
  progressText:   { color:"#F5F5F5", fontSize:14, fontWeight:"600" },
  progressPct:    { fontSize:18, fontWeight:"900", fontVariant:["tabular-nums"] },
  progressBar:    { height:8, backgroundColor:"#222226", borderRadius:4, overflow:"hidden" },
  progressFill:   { height:"100%", borderRadius:4 },
  filterRow:      { flexDirection:"row", gap:10, marginBottom:8 },
  searchInput:    { flex:1, backgroundColor:"#0E0E10", borderWidth:1, borderColor:"#222226", borderRadius:10, padding:12, color:"#F5F5F5", fontSize:13 },
  filterBtn:      { paddingHorizontal:14, paddingVertical:12, borderRadius:10, borderWidth:1, borderColor:"#222226", backgroundColor:"#0E0E10" },
  filterActive:   { borderColor:"#F46519" },
  filterText:     { color:"#6B7280", fontSize:12, fontWeight:"700" },
  catHeader:      { fontSize:12, color:"#F46519", fontWeight:"700", textTransform:"uppercase", letterSpacing:1.5, marginHorizontal:24, marginTop:16, marginBottom:8 },
  itemCard:       { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:12, padding:14, borderWidth:1, borderColor:"#222226", marginBottom:8, flexDirection:"row", alignItems:"center", gap:12 },
  itemChecked:    { opacity:0.6, borderColor:"#22C55E33" },
  checkbox:       { width:28, height:28 },
  checkboxInner:  { width:28, height:28, borderRadius:8, borderWidth:2, borderColor:"#374151", alignItems:"center", justifyContent:"center" },
  checkboxChecked:{ backgroundColor:"#22C55E", borderColor:"#22C55E" },
  checkmark:      { color:"#fff", fontWeight:"900", fontSize:14 },
  itemInfo:       { flex:1 },
  itemName:       { color:"#F5F5F5", fontSize:14, fontWeight:"600" },
  itemNameChecked:{ textDecorationLine:"line-through", color:"#6B7280" },
  itemCode:       { color:"#6B7280", fontSize:11, marginTop:2 },
  itemMeta:       { flexDirection:"row", gap:12, marginTop:4 },
  itemQty:        { color:"#6B7280", fontSize:11 },
  checkedBy:      { color:"#22C55E", fontSize:11 },
  modBtn:         { paddingHorizontal:8, paddingVertical:5, borderRadius:6, borderWidth:1, borderColor:"#374151" },
  modBtnActive:   { borderColor:"#F59E0B", backgroundColor:"#F59E0B22" },
  modText:        { color:"#6B7280", fontSize:10, fontWeight:"700" },
});
