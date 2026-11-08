package org.json;
import java.util.*;
public class JSONArray {
  final ArrayList<Object> list = new ArrayList<>();
  public JSONArray(){}
  public JSONArray(String s) throws JSONException { Object v=new Parser(s).value(); if(!(v instanceof JSONArray)) throw new JSONException("not array"); list.addAll(((JSONArray)v).list); }
  public int length(){ return list.size(); }
  public JSONArray put(Object v){ list.add(v==null?JSONObject.NULL:v); return this; }
  public Object opt(int i){ return i<list.size()?list.get(i):null; }
  public boolean isNull(int i){ Object v=opt(i); return v==null||v==JSONObject.NULL; }
  public String optString(int i){ return optString(i,""); }
  public String optString(int i,String d){ Object v=opt(i); return v==null||v==JSONObject.NULL?d:v.toString(); }
  public double optDouble(int i){ Object v=opt(i); return v instanceof Number?((Number)v).doubleValue():Double.NaN; }
  public JSONObject optJSONObject(int i){ Object v=opt(i); return v instanceof JSONObject?(JSONObject)v:null; }
  public JSONArray getJSONArray(int i) throws JSONException { Object v=opt(i); if(!(v instanceof JSONArray)) throw new JSONException("no array"); return (JSONArray)v; }
  public String toString(){ StringBuilder b=new StringBuilder("["); for(int i=0;i<list.size();i++){ if(i>0)b.append(','); b.append(JSONObject.str(list.get(i))); } return b.append(']').toString(); }
}
