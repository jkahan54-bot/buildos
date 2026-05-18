import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  const login = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login Failed", error.message);
    else router.replace("/(tabs)");
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.inner}>
        <View style={s.logo}><Text style={s.logoIcon}>🏗</Text></View>
        <Text style={s.title}>BuildOS</Text>
        <Text style={s.subtitle}>Construction Management</Text>

        <View style={s.card}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input} value={email} onChangeText={setEmail}
            placeholder="you@company.com" placeholderTextColor="#555"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          />
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor="#555" secureTextEntry
          />
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={login} disabled={loading}>
            <Text style={s.btnText}>{loading ? "Signing in…" : "Sign In"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>Sign up at buildos-six.vercel.app</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:"#08080A" },
  inner:     { flex:1, alignItems:"center", justifyContent:"center", padding:24 },
  logo:      { width:72, height:72, backgroundColor:"#F46519", borderRadius:18, alignItems:"center", justifyContent:"center", marginBottom:16 },
  logoIcon:  { fontSize:36 },
  title:     { fontSize:32, fontWeight:"900", color:"#F5F5F5", letterSpacing:-1 },
  subtitle:  { fontSize:15, color:"#6B7280", marginBottom:40 },
  card:      { width:"100%", backgroundColor:"#0E0E10", borderRadius:16, padding:24, borderWidth:1, borderColor:"#222226" },
  label:     { fontSize:13, color:"#6B7280", marginBottom:8, textTransform:"uppercase", letterSpacing:1 },
  input:     { backgroundColor:"#08080A", borderWidth:1, borderColor:"#222226", borderRadius:10, padding:14, color:"#F5F5F5", fontSize:15, marginBottom:16 },
  btn:       { backgroundColor:"#F46519", borderRadius:10, padding:16, alignItems:"center", marginTop:8 },
  btnDisabled: { opacity:0.5 },
  btnText:   { color:"#fff", fontWeight:"800", fontSize:16 },
  hint:      { marginTop:24, color:"#374151", fontSize:12 },
});
