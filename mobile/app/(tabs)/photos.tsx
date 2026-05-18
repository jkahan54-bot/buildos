import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";

const TAG_COLORS: Record<string,string> = { Inspection:"#3B82F6", Progress:"#22C55E", Safety:"#EF4444", General:"#6B7280" };

export default function PhotosScreen() {
  const [photos, setPhotos]   = useState<any[]>([]);
  const [projects, setProjects]= useState<any[]>([]);
  const [selProj, setSelProj] = useState("");
  const [selTag, setSelTag]   = useState("Progress");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPhotos();
    supabase.from("projects").select("id, name").then(({ data }) => setProjects(data ?? []));
  }, []);

  const loadPhotos = async () => {
    const { data } = await supabase.from("site_photos").select("*, projects(name)").order("taken_at", { ascending:false }).limit(50);
    setPhotos(data ?? []);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Camera permission needed"); return; }

    const result = await ImagePicker.launchCameraAsync({ quality:0.7, base64:false });
    if (result.canceled || !result.assets[0]) return;
    await uploadPhoto(result.assets[0].uri);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality:0.7 });
    if (result.canceled || !result.assets[0]) return;
    await uploadPhoto(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string) => {
    if (!selProj) { Alert.alert("Select a project first"); return; }
    setUploading(true);

    let lat: number | null = null, lng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();

    // Upload to Supabase storage
    const fileName = `site-photos/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data: upload, error } = await supabase.storage.from("buildos").upload(fileName, blob, { contentType:"image/jpeg" });

    if (error) { Alert.alert("Upload failed", error.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("buildos").getPublicUrl(fileName);

    await supabase.from("site_photos").insert({
      org_id: prof?.org_id, project_id: selProj, taken_by: user!.id,
      tag: selTag, url: publicUrl, storage_path: fileName,
      latitude: lat, longitude: lng,
      label: `${selTag} photo - ${new Date().toLocaleDateString()}`,
    });

    setUploading(false); await loadPhotos();
    Alert.alert("✓ Photo uploaded");
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={s.title}>Site Photos</Text>
        <Text style={s.sub}>{photos.length} photos logged</Text>
      </View>

      {/* Controls */}
      <View style={s.controls}>
        <Text style={s.label}>Project</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {projects.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setSelProj(p.id)}
                style={[s.chip, selProj===p.id && s.chipActive]}>
                <Text style={[s.chipText, selProj===p.id && s.chipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={s.label}>Tag</Text>
        <View style={{ flexDirection:"row", gap:8, marginBottom:16 }}>
          {Object.keys(TAG_COLORS).map(t => (
            <TouchableOpacity key={t} onPress={() => setSelTag(t)}
              style={[s.chip, selTag===t && { borderColor:TAG_COLORS[t], backgroundColor:TAG_COLORS[t]+"22" }]}>
              <Text style={[s.chipText, selTag===t && { color:TAG_COLORS[t] }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity style={[s.photoBtn, uploading && s.btnDisabled]} onPress={takePhoto} disabled={uploading}>
            <Text style={s.photoBtnText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.photoBtnOutline, uploading && s.btnDisabled]} onPress={pickPhoto} disabled={uploading}>
            <Text style={s.photoBtnOutlineText}>📁 Upload</Text>
          </TouchableOpacity>
        </View>
        {uploading && <Text style={s.uploadingText}>Uploading with GPS tag…</Text>}
      </View>

      {/* Photo grid */}
      <Text style={s.sectionTitle}>Recent Photos</Text>
      {photos.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyText}>No photos yet</Text>
        </View>
      ) : (
        <View style={s.grid}>
          {photos.map(p => (
            <View key={p.id} style={s.photoCard}>
              {p.url ? (
                <Image source={{ uri:p.url }} style={s.photoImg} />
              ) : (
                <View style={s.photoPlaceholder}><Text style={{ fontSize:30 }}>📸</Text></View>
              )}
              <View style={s.photoInfo}>
                <View style={[s.tagBadge, { backgroundColor:(TAG_COLORS[p.tag]??"#6B7280")+"22" }]}>
                  <Text style={[s.tagText, { color:TAG_COLORS[p.tag]??"#6B7280" }]}>{p.tag}</Text>
                </View>
                <Text style={s.photoLabel} numberOfLines={1}>{p.label ?? "Site photo"}</Text>
                <Text style={s.photoMeta}>{p.projects?.name} · {new Date(p.taken_at).toLocaleDateString()}</Text>
                {p.latitude && <Text style={s.gps}>📍 {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex:1, backgroundColor:"#08080A" },
  header:          { padding:24, paddingTop:60 },
  title:           { fontSize:28, fontWeight:"900", color:"#F5F5F5" },
  sub:             { fontSize:13, color:"#6B7280", marginTop:4 },
  controls:        { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:16, padding:16, borderWidth:1, borderColor:"#222226", marginBottom:24 },
  label:           { fontSize:11, color:"#6B7280", textTransform:"uppercase", letterSpacing:1, marginBottom:8 },
  chip:            { paddingHorizontal:12, paddingVertical:7, borderRadius:8, borderWidth:1, borderColor:"#222226", backgroundColor:"#08080A" },
  chipActive:      { borderColor:"#F46519", backgroundColor:"#F4651922" },
  chipText:        { color:"#6B7280", fontSize:12, fontWeight:"600" },
  chipTextActive:  { color:"#F46519" },
  btnRow:          { flexDirection:"row", gap:10 },
  photoBtn:        { flex:1, backgroundColor:"#F46519", borderRadius:12, padding:14, alignItems:"center" },
  photoBtnText:    { color:"#fff", fontWeight:"800", fontSize:14 },
  photoBtnOutline: { flex:1, borderWidth:1, borderColor:"#F46519", borderRadius:12, padding:14, alignItems:"center" },
  photoBtnOutlineText:{ color:"#F46519", fontWeight:"700", fontSize:14 },
  btnDisabled:     { opacity:0.4 },
  uploadingText:   { color:"#6B7280", fontSize:12, textAlign:"center", marginTop:10 },
  sectionTitle:    { fontSize:16, fontWeight:"800", color:"#F5F5F5", marginHorizontal:24, marginBottom:12 },
  empty:           { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:16, padding:40, alignItems:"center", borderWidth:1, borderColor:"#222226", borderStyle:"dashed" },
  emptyIcon:       { fontSize:40, marginBottom:12 },
  emptyText:       { color:"#6B7280", fontSize:15, fontWeight:"600" },
  grid:            { marginHorizontal:24, gap:10 },
  photoCard:       { backgroundColor:"#0E0E10", borderRadius:14, borderWidth:1, borderColor:"#222226", overflow:"hidden" },
  photoImg:        { width:"100%", height:180, resizeMode:"cover" },
  photoPlaceholder:{ width:"100%", height:100, backgroundColor:"#16161A", alignItems:"center", justifyContent:"center" },
  photoInfo:       { padding:12 },
  tagBadge:        { alignSelf:"flex-start", paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginBottom:6 },
  tagText:         { fontSize:10, fontWeight:"700" },
  photoLabel:      { color:"#F5F5F5", fontSize:13, fontWeight:"600", marginBottom:4 },
  photoMeta:       { color:"#6B7280", fontSize:11 },
  gps:             { color:"#374151", fontSize:10, marginTop:4 },
});
