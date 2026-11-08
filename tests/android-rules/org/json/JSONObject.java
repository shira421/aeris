// Minimal stand-in for Android's org.json, enough to run Rules.java in tests/android-rules.mjs.
package org.json;
import java.util.*;
public class JSONObject {
  public static final Object NULL = new Object(){ public String toString(){return "null";} public boolean equals(Object o){return o==null||o==this;} };
  final LinkedHashMap<String,Object> map = new LinkedHashMap<>();
  public JSONObject(){}
  public JSONObject(String s) throws JSONException { Object v=new Parser(s).value(); if(!(v instanceof JSONObject)) throw new JSONException("not object"); map.putAll(((JSONObject)v).map); }
  public JSONObject put(String k, Object v) throws JSONException { if(v instanceof Double && (((Double)v).isNaN())) throw new JSONException("NaN"); map.put(k, v==null?NULL:v); return this; }
  public JSONObject put(String k, double v) throws JSONException { return put(k,(Object)Double.valueOf(v)); }
  public JSONObject put(String k, long v) throws JSONException { return put(k,(Object)Long.valueOf(v)); }
  public JSONObject put(String k, boolean v) throws JSONException { return put(k,(Object)Boolean.valueOf(v)); }
  public Object opt(String k){ return map.get(k); }
  public boolean isNull(String k){ Object v=map.get(k); return v==null||v==NULL; }
  public String optString(String k){ return optString(k,""); }
  public String optString(String k,String d){ Object v=map.get(k); return v==null||v==NULL?d:v.toString(); }
  public double optDouble(String k){ return optDouble(k,Double.NaN); }
  public double optDouble(String k,double d){ Object v=map.get(k); return v instanceof Number?((Number)v).doubleValue():d; }
  public long optLong(String k){ Object v=map.get(k); return v instanceof Number?((Number)v).longValue():0; }
  public boolean optBoolean(String k){ Object v=map.get(k); return v instanceof Boolean && (Boolean)v; }
  public JSONObject optJSONObject(String k){ Object v=map.get(k); return v instanceof JSONObject?(JSONObject)v:null; }
  public JSONArray optJSONArray(String k){ Object v=map.get(k); return v instanceof JSONArray?(JSONArray)v:null; }
  public JSONObject getJSONObject(String k) throws JSONException { JSONObject o=optJSONObject(k); if(o==null) throw new JSONException("no "+k); return o; }
  public JSONArray getJSONArray(String k) throws JSONException { JSONArray o=optJSONArray(k); if(o==null) throw new JSONException("no "+k); return o; }
  public static String quote(String s){ StringBuilder b=new StringBuilder("\""); for(char c: s.toCharArray()){ if(c=='"'||c=='\\') b.append('\\').append(c); else if(c<0x20) b.append(String.format("\\u%04x",(int)c)); else b.append(c);} return b.append('"').toString(); }
  static String str(Object v){ if(v==null||v==NULL) return "null"; if(v instanceof String) return quote((String)v); if(v instanceof Double){double d=(Double)v; if(d==Math.rint(d)&&Math.abs(d)<1e15) return Long.toString((long)d); return Double.toString(d);} return v.toString(); }
  public String toString(){ StringBuilder b=new StringBuilder("{"); boolean f=true; for(Map.Entry<String,Object> e: map.entrySet()){ if(!f)b.append(','); f=false; b.append(quote(e.getKey())).append(':').append(str(e.getValue())); } return b.append('}').toString(); }
}
