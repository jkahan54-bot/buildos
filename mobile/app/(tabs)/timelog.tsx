import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Picker } from "react-native";
import { supabase } from "../../lib/supabase";

export default function TimeLogScreen() {
  const [projects, setProjects]     = useState<any[]>([]);
  const [selectedProj, setSelected] = useState("");
  const [current, setCurrent]       = useState<any>(null);
  const [elapsed, setElapsed]       = useState("0h 00m 00s");
  const [logs, setLogs]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (current) {
      timerRef.current = setInterval(() => {
        const diff = Date.now() - new Date(current.clock_in).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed("0h 00m 00s");
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    const [{ data: proj }, { data: cur }, { data: lg }] = await Promise.all([
      supabase.from("projects").select("id, name"),
      supabase.from("time_logs").select("*").eq("profile_id", user.id).is("clock_out", null).maybeSingle(),
      supabase.from("time_logs").select("*, projects(name)").eq("profile_id", user.id).order("clock_in", { ascending:false }).limit(20),
    ]);
    setProjects(proj ?? []);
    setCurrent(cur);
    setLogs(lg ?? []);
  };

  const clockIn = async () => {
    if (!selectedProj) { Alert.alert("Select a project first"); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("time_logs").insert({ profile_id:user!.id, project_id:selectedProj, org_id:prof?.org_id, clock_in:new Date().toISOString() });
    await load(); setLoading(false);
  };

  const clockOut = async () => {
    if (!current) return;
    setLoading(true);
    await supabase.from("time_logs").update({ clock_out:new Date().toISOString() }).eq("id", current.id);
    setCurrent(null); await load(); setLoading(false);
  };

  const weekHours = logs
    .filter(l => l.hours && new Date(l.clock_in) > new Date(Date.now() - 7*86400000))
    .reduce((s,l) => s + (l.hours ?? 0), 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>Time Log</Text>
        <Text style={s.sub}>Clock in/out & weekly hours</Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color:"#F46519" }]}>{weekHours.toFixed(1)}h</Text>
          <Text style={s.statLabel}>This Week</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: current ? "#22C55E" : "#6B7280" }]}>{current ? "On Site" : "Off Site"}</Text>
          <Text style={s.statLabel}>Status</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color:"#3B82F6" }]}>{logs.length}</Text>
          <Text style={s.statLabel}>Entries</Text>
        </View>
      </View>

      {/* Clock widget */}
      <View style={s.clockCard}>
        {current ? (
          <>
            <Text style={s.clockStatus}>⏱ CLOCKED IN</Text>
            <Text style={s.clockTime}>{elapsed}</Text>
            <Text style={s.clockSince}>Since {new Date(current.clock_in).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</Text>
            <TouchableOpacity style={s.clockOutBtn} onPress={clockOut} disabled={loading}>
              <Text style={s.clockBtnText}>{loading ? "…" : "Clock Out"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.clockPrompt}>Select project and clock in</Text>
            <View style={s.pickerWrap}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setSelected(p.id)}
                  style={[s.projOption, selectedProj === p.id && s.projSelected]}>
                  <Text style={[s.projText, selectedProj === p.id && s.projTextSelected]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.clockInBtn, (!selectedProj || loading) && s.btnDisabled]} onPress={clockIn} disabled={!selectedProj || loading}>
              <Text style={s.clockBtnText}>{loading ? "…" : "Clock In"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Recent logs */}
      <Text style={s.sectionTitle}>Recent Entries</Text>
      <View style={s.logTable}>
        <View style={[s.logRow, s.logHeader]}>
          {["Date","Project","In","Out","Hrs"].map(h => (
            <Text key={h} style={s.logHead}>{h}</Text>
          ))}
        </View>
        {logs.slice(0,15).map(l => (
          <View key={l.id} style={s.logRow}>
            <Text style={s.logCell}>{new Date(l.clock_in).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</Text>
            <Text style={[s.logCell, { flex:1.5 }]} numberOfLines={1}>{l.projects?.name?.split(" ")[0] ?? "—"}</Text>
            <Text style={s.logCell}>{new Date(l.clock_in).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</Text>
            <Text style={s.logCell}>{l.clock_out ? new Date(l.clock_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : <Text style={{color:"#22C55E"}}>Live</Text>}</Text>
            <Text style={[s.logCell, { color: l.hours > 9 ? "#F59E0B" : "#F5F5F5", fontWeight:"700" }]}>{l.hours?.toFixed(1) ?? "—"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex:1, backgroundColor:"#08080A" },
  header:          { padding:24, paddingTop:60 },
  title:           { fontSize:28, fontWeight:"900", color:"#F5F5F5" },
  sub:             { fontSize:13, color:"#6B7280", marginTop:4 },
  statsRow:        { flexDirection:"row", gap:10, marginHorizontal:24, marginBottom:20 },
  statCard:        { flex:1, backgroundColor:"#0E0E10", borderRadius:12, padding:14, borderWidth:1, borderColor:"#222226", alignItems:"center" },
  statVal:         { fontSize:18, fontWeight:"900" },
  statLabel:       { fontSize:10, color:"#6B7280", marginTop:4, textTransform:"uppercase" },
  clockCard:       { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:18, padding:24, borderWidth:1, borderColor:"#222226", alignItems:"center", marginBottom:24 },
  clockStatus:     { color:"#22C55E", fontWeight:"700", fontSize:12, letterSpacing:1.5, marginBottom:8 },
  clockTime:       { fontSize:40, fontWeight:"900", color:"#F5F5F5", fontVariant:["tabular-nums"], marginBottom:8 },
  clockSince:      { color:"#6B7280", fontSize:13, marginBottom:20 },
  clockPrompt:     { color:"#6B7280", fontSize:14, marginBottom:16 },
  pickerWrap:      { width:"100%", gap:8, marginBottom:16 },
  projOption:      { padding:12, borderRadius:10, borderWidth:1, borderColor:"#222226", backgroundColor:"#08080A" },
  projSelected:    { borderColor:"#F46519", backgroundColor:"#F4651922" },
  projText:        { color:"#9CA3AF", fontSize:14 },
  projTextSelected:{ color:"#F46519", fontWeight:"700" },
  clockInBtn:      { backgroundColor:"#F46519", borderRadius:12, paddingVertical:14, paddingHorizontal:40 },
  clockOutBtn:     { backgroundColor:"#EF4444", borderRadius:12, paddingVertical:14, paddingHorizontal:40 },
  btnDisabled:     { opacity:0.4 },
  clockBtnText:    { color:"#fff", fontWeight:"800", fontSize:16 },
  sectionTitle:    { fontSize:16, fontWeight:"800", color:"#F5F5F5", marginHorizontal:24, marginBottom:12 },
  logTable:        { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:14, borderWidth:1, borderColor:"#222226", overflow:"hidden" },
  logHeader:       { backgroundColor:"#16161A", borderBottomWidth:1, borderColor:"#222226" },
  logRow:          { flexDirection:"row", paddingVertical:12, paddingHorizontal:14, borderBottomWidth:1, borderColor:"#22222633" },
  logHead:         { flex:1, color:"#6B7280", fontSize:10, fontWeight:"700", textTransform:"uppercase", letterSpacing:0.5 },
  logCell:         { flex:1, color:"#F5F5F5", fontSize:12 },
});
