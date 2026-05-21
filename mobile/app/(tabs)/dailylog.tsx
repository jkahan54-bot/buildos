import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native";
import { supabase } from "../../lib/supabase";

export default function DailyLogScreen() {
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [form, setForm] = useState({
    project_id:"", weather:"Clear", crew_count:"",
    work_done:"", materials:"", equipment:"", issues:""
  });

  useEffect(() => {
    supabase.from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("daily_logs")
      .select("*, projects(name)").eq("profile_id", user!.id)
      .order("created_at", { ascending: false }).limit(5);
    setLogs(data ?? []);
  };

  const save = async () => {
    if (!form.project_id || !form.work_done) {
      Alert.alert("Required", "Select a project and describe work done.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const { error } = await supabase.from("daily_logs").insert({
      ...form, org_id: prof?.org_id, profile_id: user!.id,
      crew_count: form.crew_count ? parseInt(form.crew_count) : null,
      log_date: new Date().toISOString().split("T")[0],
    });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setSaved(true);
    setForm({ project_id:"", weather:"Clear", crew_count:"", work_done:"", materials:"", equipment:"", issues:"" });
    setTimeout(() => setSaved(false), 3000);
    await loadLogs();
  };

  const inp: any = { backgroundColor:"#fff", borderWidth:1, borderColor:"#d1d5db", borderRadius:10, padding:12, fontSize:14, color:"#111827", marginBottom:12 };
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const WEATHERS = ["Clear","Cloudy","Rain","Snow","Hot","Cold","Windy"];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>Daily Log</Text>
        <Text style={s.sub}>{today}</Text>
      </View>

      {saved && (
        <View style={{ backgroundColor:"#dcfce7", borderColor:"#16a34a", borderWidth:1, borderRadius:12, padding:14, margin:16, marginBottom:0, flexDirection:"row", alignItems:"center", gap:8 }}>
          <Text style={{ fontSize:18 }}>✅</Text>
          <Text style={{ color:"#15803d", fontWeight:"700", fontSize:14 }}>Daily log saved!</Text>
        </View>
      )}

      <View style={s.card}>
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

        <Text style={s.label}>Weather</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {WEATHERS.map(w => (
              <TouchableOpacity key={w} onPress={() => setForm(f => ({...f, weather:w}))}
                style={[s.chip, form.weather===w && s.chipActive]}>
                <Text style={[s.chipText, form.weather===w && s.chipTextActive]}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={s.label}>Crew on site</Text>
        <TextInput value={form.crew_count} onChangeText={v => setForm(f => ({...f, crew_count:v}))}
          keyboardType="numeric" placeholder="e.g. 22" style={inp} />

        <Text style={s.label}>Work performed today *</Text>
        <TextInput value={form.work_done} onChangeText={v => setForm(f => ({...f, work_done:v}))}
          multiline numberOfLines={4} placeholder="Describe all work completed today..."
          style={[inp, { height:100, textAlignVertical:"top" }]} />

        <Text style={s.label}>Materials received</Text>
        <TextInput value={form.materials} onChangeText={v => setForm(f => ({...f, materials:v}))}
          placeholder="e.g. 40 tons rebar, 200 sheets plywood" style={inp} />

        <Text style={s.label}>Equipment used</Text>
        <TextInput value={form.equipment} onChangeText={v => setForm(f => ({...f, equipment:v}))}
          placeholder="e.g. Tower crane, concrete pumps" style={inp} />

        <Text style={s.label}>Issues / delays</Text>
        <TextInput value={form.issues} onChangeText={v => setForm(f => ({...f, issues:v}))}
          multiline numberOfLines={3} placeholder="Any issues, delays or safety concerns..."
          style={[inp, { height:80, textAlignVertical:"top" }]} />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={save} disabled={loading}>
          <Text style={s.btnText}>{loading ? "Saving…" : "Save Daily Log"}</Text>
        </TouchableOpacity>
      </View>

      {logs.length > 0 && (
        <View style={s.card}>
          <Text style={{ fontSize:14, fontWeight:"700", color:"#111827", marginBottom:12 }}>Recent Logs</Text>
          {logs.map(l => (
            <View key={l.id} style={{ borderBottomWidth:1, borderColor:"#f3f4f6", paddingBottom:10, marginBottom:10 }}>
              <Text style={{ fontWeight:"600", fontSize:13, color:"#111827" }}>{l.projects?.name}</Text>
              <Text style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{l.log_date} · {l.work_done?.slice(0,60)}...</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex:1, backgroundColor:"#f9fafb" },
  header:      { padding:20, paddingTop:60 },
  title:       { fontSize:24, fontWeight:"800", color:"#111827" },
  sub:         { fontSize:13, color:"#6b7280", marginTop:4 },
  card:        { backgroundColor:"#fff", borderRadius:16, borderWidth:1, borderColor:"#e5e7eb", margin:16, marginTop:8, padding:16 },
  label:       { fontSize:12, fontWeight:"700", color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  btn:         { backgroundColor:"#f97316", borderRadius:12, padding:16, alignItems:"center", marginTop:4 },
  btnDisabled: { opacity:0.5 },
  btnText:     { color:"#fff", fontWeight:"800", fontSize:15 },
  chip:        { paddingHorizontal:14, paddingVertical:8, borderRadius:8, borderWidth:1, borderColor:"#e5e7eb", backgroundColor:"#f9fafb" },
  chipActive:  { borderColor:"#f97316", backgroundColor:"#fff7ed" },
  chipText:    { fontSize:13, color:"#6b7280", fontWeight:"600" },
  chipTextActive: { color:"#f97316" },
});
