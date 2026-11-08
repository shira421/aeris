// ICAO type designators → published dimensions (metres) and configuration.
// Dimensions are manufacturer reference figures for the variant named; individual airframes
// differ (winglets, sharklets, engine options). Used for the 3D model and the aircraft facts.
//   cls: map silhouette  heavy · jumbo · narrow · regional · turboprop · biz · light · heli
//   eng: engine count    mount: wing | tail | tri (two wing + one tail)
//   prop: propellers     wing: low | high    tail: low | T    deck: single | hump | double
//   w: fuselage width
const T=(name,maker,L,span,H,w,o={})=>({name,maker,length:L,span,height:H,width:w,eng:2,mount:'wing',prop:false,wing:'low',tail:'low',deck:'single',cls:'narrow',...o});
const heavy={cls:'heavy'},quad={eng:4,cls:'jumbo'},rj={mount:'tail',tail:'T',cls:'regional'},tp={prop:true,wing:'high',tail:'T',cls:'turboprop'},biz={mount:'tail',tail:'T',cls:'biz'},ga={prop:true,eng:1,cls:'light'},heli={cls:'heli',eng:1,rotor:true};
export const TYPES={
 // Airbus
 A318:T('Airbus A318','Airbus',31.44,34.10,12.56,3.95),A319:T('Airbus A319','Airbus',33.84,35.80,11.76,3.95),A320:T('Airbus A320','Airbus',37.57,35.80,11.76,3.95),A321:T('Airbus A321','Airbus',44.51,35.80,11.76,3.95),
 A19N:T('Airbus A319neo','Airbus',33.84,35.80,11.76,3.95),A20N:T('Airbus A320neo','Airbus',37.57,35.80,11.76,3.95),A21N:T('Airbus A321neo','Airbus',44.51,35.80,11.76,3.95),
 BCS1:T('Airbus A220-100','Airbus',35.00,35.10,11.50,3.51),BCS3:T('Airbus A220-300','Airbus',38.70,35.10,11.50,3.51),
 A306:T('Airbus A300-600','Airbus',54.08,44.84,16.62,5.64,heavy),A310:T('Airbus A310','Airbus',46.66,43.90,15.80,5.64,heavy),
 A332:T('Airbus A330-200','Airbus',58.82,60.30,17.39,5.64,heavy),A333:T('Airbus A330-300','Airbus',63.66,60.30,16.79,5.64,heavy),A338:T('Airbus A330-800','Airbus',58.82,64.00,17.39,5.64,heavy),A339:T('Airbus A330-900','Airbus',63.66,64.00,16.79,5.64,heavy),
 A342:T('Airbus A340-200','Airbus',59.40,60.30,16.70,5.64,quad),A343:T('Airbus A340-300','Airbus',63.69,60.30,16.85,5.64,quad),A345:T('Airbus A340-500','Airbus',67.93,63.45,17.53,5.64,quad),A346:T('Airbus A340-600','Airbus',75.36,63.45,17.93,5.64,quad),
 A359:T('Airbus A350-900','Airbus',66.80,64.75,17.05,5.96,heavy),A35K:T('Airbus A350-1000','Airbus',73.79,64.75,17.08,5.96,heavy),
 A388:T('Airbus A380-800','Airbus',72.72,79.75,24.09,7.14,{...quad,deck:'double'}),
 A400:T('Airbus A400M Atlas','Airbus',45.10,42.40,14.70,5.64,{eng:4,prop:true,wing:'high',tail:'T',cls:'heavy'}),
 // Boeing
 B712:T('Boeing 717-200','Boeing',37.81,28.45,8.92,3.34,{mount:'tail',tail:'T'}),
 B733:T('Boeing 737-300','Boeing',33.40,28.88,11.13,3.76),B734:T('Boeing 737-400','Boeing',36.40,28.88,11.13,3.76),B735:T('Boeing 737-500','Boeing',31.00,28.88,11.13,3.76),
 B736:T('Boeing 737-600','Boeing',31.24,34.32,12.57,3.76),B737:T('Boeing 737-700','Boeing',33.63,35.79,12.57,3.76),B738:T('Boeing 737-800','Boeing',39.47,35.79,12.55,3.76),B739:T('Boeing 737-900ER','Boeing',42.11,35.79,12.55,3.76),
 B37M:T('Boeing 737 MAX 7','Boeing',35.56,35.92,12.29,3.76),B38M:T('Boeing 737 MAX 8','Boeing',39.52,35.92,12.29,3.76),B39M:T('Boeing 737 MAX 9','Boeing',42.16,35.92,12.29,3.76),B3XM:T('Boeing 737 MAX 10','Boeing',43.80,35.92,12.29,3.76),
 P8:T('Boeing P-8 Poseidon','Boeing',39.47,37.64,12.83,3.76),
 B752:T('Boeing 757-200','Boeing',47.32,38.05,13.56,3.76),B753:T('Boeing 757-300','Boeing',54.43,38.05,13.56,3.76),
 B762:T('Boeing 767-200','Boeing',48.51,47.57,15.85,5.03,heavy),B763:T('Boeing 767-300','Boeing',54.94,47.57,15.85,5.03,heavy),B764:T('Boeing 767-400ER','Boeing',61.37,51.92,16.87,5.03,heavy),
 B772:T('Boeing 777-200','Boeing',63.73,60.93,18.52,6.19,heavy),B77L:T('Boeing 777-200LR','Boeing',63.73,64.80,18.57,6.19,heavy),B773:T('Boeing 777-300','Boeing',73.86,60.93,18.52,6.19,heavy),B77W:T('Boeing 777-300ER','Boeing',73.86,64.80,18.50,6.19,heavy),
 B778:T('Boeing 777-8','Boeing',70.86,71.75,19.48,6.19,heavy),B779:T('Boeing 777-9','Boeing',76.72,71.75,19.68,6.19,heavy),
 B788:T('Boeing 787-8','Boeing',56.72,60.12,16.92,5.77,heavy),B789:T('Boeing 787-9','Boeing',62.81,60.12,17.02,5.77,heavy),B78X:T('Boeing 787-10','Boeing',68.28,60.12,17.02,5.77,heavy),
 B742:T('Boeing 747-200','Boeing',70.66,59.64,19.33,6.50,{...quad,deck:'hump'}),B744:T('Boeing 747-400','Boeing',70.66,64.44,19.41,6.50,{...quad,deck:'hump'}),B748:T('Boeing 747-8','Boeing',76.25,68.45,19.35,6.50,{...quad,deck:'hump'}),
 K35R:T('Boeing KC-135R Stratotanker','Boeing',41.53,39.88,12.70,3.76,{eng:4,cls:'heavy'}),C17:T('Boeing C-17A Globemaster III','Boeing',53.04,51.75,16.79,6.86,{eng:4,wing:'high',tail:'T',cls:'heavy'}),
 // McDonnell Douglas
 MD11:T('McDonnell Douglas MD-11','McDonnell Douglas',61.62,51.97,17.60,6.02,{eng:3,mount:'tri',cls:'heavy'}),DC10:T('McDonnell Douglas DC-10','McDonnell Douglas',55.50,50.40,17.70,6.02,{eng:3,mount:'tri',cls:'heavy'}),
 MD82:T('McDonnell Douglas MD-82','McDonnell Douglas',45.06,32.87,9.05,3.34,{mount:'tail',tail:'T'}),MD83:T('McDonnell Douglas MD-83','McDonnell Douglas',45.06,32.87,9.05,3.34,{mount:'tail',tail:'T'}),MD88:T('McDonnell Douglas MD-88','McDonnell Douglas',45.06,32.87,9.05,3.34,{mount:'tail',tail:'T'}),MD90:T('McDonnell Douglas MD-90','McDonnell Douglas',46.50,32.87,9.33,3.34,{mount:'tail',tail:'T'}),
 // Embraer
 E170:T('Embraer E170','Embraer',29.90,26.00,9.67,3.01,{cls:'regional'}),E75L:T('Embraer E175','Embraer',31.68,26.00,9.73,3.01,{cls:'regional'}),E75S:T('Embraer E175','Embraer',31.68,26.00,9.73,3.01,{cls:'regional'}),
 E190:T('Embraer E190','Embraer',36.24,28.72,10.57,3.01,{cls:'regional'}),E195:T('Embraer E195','Embraer',38.65,28.72,10.57,3.01,{cls:'regional'}),
 E290:T('Embraer E190-E2','Embraer',36.25,33.72,10.95,3.01,{cls:'regional'}),E295:T('Embraer E195-E2','Embraer',41.51,35.12,10.91,3.01,{cls:'regional'}),
 E135:T('Embraer ERJ-135','Embraer',26.33,20.04,6.76,2.28,rj),E145:T('Embraer ERJ-145','Embraer',29.87,20.04,6.76,2.28,rj),
 E55P:T('Embraer Phenom 300','Embraer',15.90,16.20,5.10,1.60,biz),E50P:T('Embraer Phenom 100','Embraer',12.82,12.30,4.35,1.55,biz),
 // Bombardier / de Havilland Canada
 CRJ2:T('Bombardier CRJ200','Bombardier',26.77,21.21,6.22,2.69,rj),CRJ7:T('Bombardier CRJ700','Bombardier',32.51,23.24,7.57,2.69,rj),CRJ9:T('Bombardier CRJ900','Bombardier',36.40,24.85,7.51,2.69,rj),CRJX:T('Bombardier CRJ1000','Bombardier',39.13,26.18,7.50,2.69,rj),
 DH8A:T('De Havilland Canada Dash 8-100','De Havilland Canada',22.25,25.91,7.49,2.69,tp),DH8C:T('De Havilland Canada Dash 8-300','De Havilland Canada',25.68,27.43,7.49,2.69,tp),DH8D:T('De Havilland Canada Dash 8-400','De Havilland Canada',32.83,28.42,8.34,2.69,tp),
 DHC6:T('De Havilland Canada Twin Otter','De Havilland Canada',15.77,19.81,5.94,1.6,{prop:true,wing:'high',cls:'turboprop'}),
 GLEX:T('Bombardier Global Express','Bombardier',30.30,28.65,7.57,2.69,biz),GL7T:T('Bombardier Global 7500','Bombardier',33.80,31.70,8.20,2.69,biz),CL35:T('Bombardier Challenger 350','Bombardier',20.92,21.00,6.10,2.18,biz),CL60:T('Bombardier Challenger 650','Bombardier',20.85,19.61,6.30,2.69,biz),
 // ATR, Saab, others
 AT43:T('ATR 42-300','ATR',22.67,24.57,7.59,2.77,tp),AT45:T('ATR 42-500','ATR',22.67,24.57,7.59,2.77,tp),AT46:T('ATR 42-600','ATR',22.67,24.57,7.59,2.77,tp),
 AT72:T('ATR 72','ATR',27.17,27.05,7.65,2.77,tp),AT75:T('ATR 72-500','ATR',27.17,27.05,7.65,2.77,tp),AT76:T('ATR 72-600','ATR',27.17,27.05,7.65,2.77,tp),
 SF34:T('Saab 340','Saab',19.73,21.44,6.97,2.3,{prop:true,cls:'turboprop'}),SB20:T('Saab 2000','Saab',27.28,24.76,7.73,2.3,{prop:true,cls:'turboprop'}),
 C130:T('Lockheed C-130 Hercules','Lockheed Martin',29.79,40.41,11.84,4.3,{eng:4,prop:true,wing:'high',cls:'heavy'}),C30J:T('Lockheed Martin C-130J Super Hercules','Lockheed Martin',29.79,40.41,11.84,4.3,{eng:4,prop:true,wing:'high',cls:'heavy'}),
 // Business jets and turboprops
 C56X:T('Cessna Citation Excel','Cessna',15.79,17.17,5.24,1.7,{mount:'tail',cls:'biz'}),C68A:T('Cessna Citation Latitude','Cessna',18.97,22.05,6.37,1.96,biz),C700:T('Cessna Citation Longitude','Cessna',22.30,20.65,5.92,1.96,biz),
 GLF4:T('Gulfstream IV','Gulfstream',26.92,23.72,7.45,2.24,biz),GLF5:T('Gulfstream V','Gulfstream',29.39,28.50,7.87,2.24,biz),GLF6:T('Gulfstream G650','Gulfstream',30.41,30.36,7.82,2.59,biz),
 F900:T('Dassault Falcon 900','Dassault',20.21,19.33,7.55,2.34,{eng:3,mount:'tail',cls:'biz'}),FA7X:T('Dassault Falcon 7X','Dassault',23.19,26.21,7.83,2.34,{eng:3,mount:'tail',cls:'biz'}),
 LJ45:T('Learjet 45','Bombardier',17.68,14.58,4.30,1.6,biz),PC24:T('Pilatus PC-24','Pilatus',16.85,17.00,5.40,1.8,{mount:'tail',cls:'biz'}),
 PC12:T('Pilatus PC-12','Pilatus',14.40,16.28,4.26,1.6,{...ga,tail:'T',cls:'turboprop'}),B350:T('Beechcraft King Air 350','Beechcraft',14.22,17.65,4.37,1.5,{prop:true,tail:'T',cls:'turboprop'}),BE20:T('Beechcraft King Air 200','Beechcraft',13.36,16.61,4.57,1.5,{prop:true,tail:'T',cls:'turboprop'}),
 C208:T('Cessna 208 Caravan','Cessna',11.46,15.88,4.32,1.6,{...ga,wing:'high',cls:'turboprop'}),
 // Light aircraft
 C150:T('Cessna 150','Cessna',7.29,10.17,2.59,1.0,{...ga,wing:'high'}),C152:T('Cessna 152','Cessna',7.34,10.11,2.59,1.0,{...ga,wing:'high'}),C172:T('Cessna 172 Skyhawk','Cessna',8.28,11.00,2.72,1.0,{...ga,wing:'high'}),C182:T('Cessna 182 Skylane','Cessna',8.84,10.97,2.84,1.0,{...ga,wing:'high'}),
 P28A:T('Piper PA-28 Cherokee','Piper',7.25,10.67,2.22,1.0,ga),SR20:T('Cirrus SR20','Cirrus',7.92,11.68,2.71,1.1,ga),SR22:T('Cirrus SR22','Cirrus',7.92,11.68,2.72,1.1,ga),
 DA40:T('Diamond DA40','Diamond',8.06,11.94,1.97,1.0,{...ga,tail:'T'}),DA42:T('Diamond DA42','Diamond',8.56,13.55,2.49,1.0,{...ga,eng:2,tail:'T'}),BE36:T('Beechcraft Bonanza','Beechcraft',8.38,10.21,2.62,1.1,ga),
 // Helicopters (span = main rotor diameter)
 EC35:T('Airbus H135','Airbus Helicopters',12.16,10.20,3.35,1.5,heli),EC45:T('Airbus H145','Airbus Helicopters',13.03,11.00,3.96,1.6,heli),AS50:T('Airbus H125','Airbus Helicopters',10.93,10.69,3.34,1.4,heli),EC30:T('Airbus H130','Airbus Helicopters',10.68,10.69,3.34,1.6,heli),
 A139:T('Leonardo AW139','Leonardo',16.66,13.80,4.98,2.0,heli),S92:T('Sikorsky S-92','Sikorsky',17.10,17.17,4.71,2.2,heli),B06:T('Bell 206 JetRanger','Bell',11.82,10.16,2.91,1.3,heli),B407:T('Bell 407','Bell',12.70,10.67,3.56,1.4,heli),R44:T('Robinson R44','Robinson',11.66,10.06,3.28,1.3,heli),R22:T('Robinson R22','Robinson',8.76,7.67,2.67,1.1,heli),H60:T('Sikorsky UH-60 Black Hawk','Sikorsky',19.76,16.36,5.13,2.4,heli)
};
// ADS-B emitter categories → a representative configuration when the type is unknown.
const BY_CATEGORY={A1:'C172',A2:'C56X',A3:'A320',A4:'B752',A5:'B77W',A6:'A320',A7:'EC35',B1:'C172',B4:'C172',B6:'C172'};
export const GENERIC=T('Unidentified aircraft','—',38,35,12,3.9,{generic:true});
/** The best model for a flight: its exact type, else one implied by its emitter category. */
export function typeFor(code,category){
 if(code&&TYPES[code])return {code,spec:TYPES[code],exact:true};
 const alias=code&&{A21:'A321',B78:'B788',A35:'A359',B77:'B77W',B74:'B744',B73:'B738'}[code.slice(0,3)];
 if(alias)return {code:alias,spec:TYPES[alias],exact:false};
 const byCat=BY_CATEGORY[category];if(byCat)return {code:byCat,spec:TYPES[byCat],exact:false};
 return {code:null,spec:GENERIC,exact:false};
}
/** Map silhouette class from type, category, or nothing. */
export function iconClass(f){const t=f.type&&TYPES[f.type];if(t)return t.cls;return ({A1:'light',A2:'biz',A3:'narrow',A4:'narrow',A5:'heavy',A7:'heli',B1:'light',B2:'light',C1:'ground',C2:'ground',C3:'ground'})[f.category]||'narrow';}
