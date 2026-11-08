package org.json;
class Parser { final String s; int i=0; Parser(String s){this.s=s;}
  void ws(){ while(i<s.length()&&Character.isWhitespace(s.charAt(i))) i++; }
  Object value() throws JSONException { ws(); char c=s.charAt(i);
    if(c=='{'){ i++; JSONObject o=new JSONObject(); ws(); if(s.charAt(i)=='}'){i++;return o;} while(true){ ws(); String k=(String)value(); ws(); i++; Object v=value(); o.map.put(k,v); ws(); char d=s.charAt(i++); if(d=='}') return o; } }
    if(c=='['){ i++; JSONArray a=new JSONArray(); ws(); if(s.charAt(i)==']'){i++;return a;} while(true){ a.list.add(value()); ws(); char d=s.charAt(i++); if(d==']') return a; } }
    if(c=='"'){ i++; StringBuilder b=new StringBuilder(); while(true){ char d=s.charAt(i++); if(d=='"') return b.toString(); if(d=='\\'){ char e=s.charAt(i++); if(e=='u'){ b.append((char)Integer.parseInt(s.substring(i,i+4),16)); i+=4; } else b.append(e=='n'?'\n':e=='t'?'\t':e=='r'?'\r':e=='b'?'\b':e=='f'?'\f':e); } else b.append(d); } }
    if(s.startsWith("true",i)){i+=4;return Boolean.TRUE;} if(s.startsWith("false",i)){i+=5;return Boolean.FALSE;} if(s.startsWith("null",i)){i+=4;return JSONObject.NULL;}
    int st=i; while(i<s.length()&&"+-0123456789.eE".indexOf(s.charAt(i))>=0) i++; String n=s.substring(st,i); if(n.matches("-?\\d+")&&n.length()<18) return Long.parseLong(n); return Double.parseDouble(n); }
}
