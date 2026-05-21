import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native";
import { supabase } from "../../lib/supabase";

const STATUS_COLOR: Record<string,string> = { Open:"#f97316", Review:"#2563eb", Closed:"#6b7280" };
const PRIORITY_COLOR: Record<string,string> = { Low:"#16a34a", Medium:"#d97706", High:"#dc2626" };

export default function RFIsScreen() {
  const [rfis, setRFIs]         = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [form, setForm] = useState({ project_id:"", title:"", description:"", priority:"Medium" });

  useEffect(() => {
    load();
    supabase.from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
  }, []);

  const load = async () => {
    const { data } = await supabase.from("rfis").select("*, projects(name)").order("created_at", { ascending:false }).limit(30);
    setRFIs(data ?? []);
  };

  const submit = async () => {
    if (!form.project_id || !form.title) { Alert.alert("Required", "Select a project and enter a title."); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("rfis").insert({ ...form, org_id: prof?.org_id, submitted_by: user!.id, status:"Open" });
    setLoading(false); setShowForm(false);
    setForm({ project_id:"", title:"", description:"", priority:"Medium" });
    await load();
    Alert.alert("✓ RFI Submitted", "Your RFI has been submitted for review.");
  };

  const inp: any = { backgroundColor:"#fff", borderWidth:1, borderColor:"#d1d5db", borderRadius:10, padding:12, fontSize:14, color:"#111827", marginBottom:12 };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>RFIs</Text>
        <Text style={s.sub}>Requests for Information · {rfis.filter(r=>r.status==="Open").length} open</Text>
      </View>

      <View style={{ paddingHorizontal:16, marginBottom:8 }}>
        <TouchableOpacity style={s.btn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.btnText}>{showForm ? "Cancel" : "+ Submit New RFI"}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={[s.card, { borderColor:"#f97316" }]}>
          <Text style={{ fontSize:16, fontWeight:"800", color:"#111827", marginBottom:14 }}>New RFI</Text>

          <Text style={s.label}>Project *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:"row", gap:8 }}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setForm(f => ({...f, project_id:p.id}))}
                  style={[s.chip, form.project_id===p.id && s.chipActive]}>
                  <Text style={[s.chipText, form.project_id===p.id && s.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.label}>Priority</Text>
          <View style={{ flexDirection:"row", gap:8, marginBottom:12 }}>
            {["Low","Medium","High"].map(p => (
              <TouchableOpacity key={p} onPress={() => setForm(f => ({...f, priority:p}))}
                style={[s.chip, form.priority===p && { borderColor:PRIORITY_COLOR[p], backgroundColor:PRIORITY_COLOR[p]+"15" }]}>
                <Text style={[s.chipText, form.priority===p && { color:PRIORITY_COLOR[p] }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Question / Issue *</Text>
          <TextInput value={form.title} onChangeText={v => setForm(f => ({...f, title:v}))}
            placeholder="e.g. Clarification needed on beam connection at Grid C-4" style={inp} />

          <Text style={s.label}>Details</Text>
          <TextInput value={form.description} onChangeText={v => setForm(f => ({...f, description:v}))}
            multiline numberOfLines={4} placeholder="Provide more context..."
            style={[inp, { height:90, textAlignVertical:"top" }]} />

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            <Text style={s.btnText}>{loading ? "Submitting…" : "Submit RFI"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ paddingHorizontal:16 }}>
        {rfis.length === 0 ? (
          <View style={{ alignItems:"center", padding:40 }}>
            <Text style={{ fontSize:32, marginBottom:12 }}>?</Text>
            <Text style={{ color:"#6b7280", fontWeight:"600" }}>No RFIs yet</Text>
          </View>
        ) : rfis.map(r => (
          <View key={r.id} style={[s.card, { borderLeftWidth:4, borderLeftColor:STATUS_COLOR[r.status]??"#6b7280" }]}>
            <View style={{ flexDirection:"row", alignItems:"flex-start", gap:10 }}>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:"row", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                  <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:6, backgroundColor:(STATUS_COLOR[r.status]??"#6b7280")+"20" }}>
                    <Text style={{ fontSize:11, fontWeight:"700", color:STATUS_COLOR[r.status]??"#6b7280" }}>{r.status}</Text>
                  </View>
                  <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:6, backgroundColor:(PRIORITY_COLOR[r.priority]??"#6b7280")+"20" }}>
                    <Text style={{ fontSize:11, fontWeight:"700", color:PRIORITY_COLOR[r.priority]??"#6b7280" }}>{r.priority}</Text>
                  </View>
                </View>
                <Text style={{ fontWeight:"700", fontSize:14, color:"#111827" }}>{r.title}</Text>
                <Text style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>
                  {r.projects?.name} · {new Date(r.created_at).toLocaleDateString()}
                </Text>
                {r.response && (
                  <View style={{ backgroundColor:"#f0fdf4", borderRadius:8, padding:10, marginTop:8 }}>
                    <Text style={{ fontSize:11, color:"#15803d", fontWeight:"700", marginBottom:3 }}>Response:</Text>
                    <Text style={{ fontSize:13, color:"#166534" }}>{r.response}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex:1, backgroundColor:"#f9fafb" },
  header:      { padding:20, paddingTop:60 },
  title:       { fontSize:24, fontWeight:"800", color:"#111827" },
  sub:         { fontSize:13, color:"#6b7280", marginTop:4 },
  card:        { backgroundColor:"#fff", borderRadius:14, borderWidth:1, borderColor:"#e5e7eb", marginBottom:10, padding:14 },
  label:       { fontSize:12, fontWeight:"700", color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  btn:         { backgroundColor:"#f97316", borderRadius:12, padding:14, alignItems:"center" },
  btnDisabled: { opacity:0.5 },
  btnText:     { color:"#fff", fontWeight:"800", fontSize:14 },
  chip:        { paddingHorizontal:14, paddingVertical:8, borderRadius:8, borderWidth:1, borderColor:"#e5e7eb", backgroundColor:"#f9fafb" },
  chipActive:  { borderColor:"#f97316", backgroundColor:"#fff7ed" },
  chipText:    { fontSize:13, color:"#6b7280", fontWeight:"600" },
  chipTextActive: { color:"#f97316" },
});
