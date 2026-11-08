package com.shira421.aeris;
// Test harness for tests/android-rules.mjs (not part of the app).
import org.json.*; import java.io.*; import java.nio.file.*;
/** Reads lines of {item, response, now} and prints {state, alerts} for each, feeding the state forward. */
public class Harness { public static void main(String[] a) throws Exception {
  Rules.Airports ap = Rules.airports(new android.content.Context());
  BufferedReader r=new BufferedReader(new InputStreamReader(System.in)); String line; JSONObject state=null;
  while((line=r.readLine())!=null){ JSONObject in=new JSONObject(line); JSONObject item=in.getJSONObject("item"); if(state!=null) item.put("state",state);
    JSONObject resp=in.isNull("response")?null:in.getJSONObject("response");
    Rules.Result res=Rules.step(item, Rules.first(resp), in.optDouble("now"), ap); state=res.state;
    JSONArray al=new JSONArray(); for(String[] x: res.alerts){ JSONArray t=new JSONArray(); t.put(x[0]); t.put(x[1]); t.put(x[2]); al.put(t);} 
    JSONObject out=new JSONObject(); out.put("alerts",al); out.put("status",state.opt("status")); System.out.println(out); } } }
