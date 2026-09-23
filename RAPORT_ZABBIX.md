# Seirepraktikum: Zabbix — Raport

**Aine:** IT juhtimine ja rakendamine organisatsioonides  
**Teema:** 7. Sissejuhatus rakenduste ning IT-teenuste seiresse  
**Töö:** Meeskonnatöö: seirelahenduse kasutamine  

---

## 1. Meeskonna andmed

- **Meeskonna liikmed:** [Sisesta nimed siia]
- **Meeskonna nimi:** `team-autoservice` (või teie meeskonna nimi)
- **Zabbixi aadress:** `https://zabbix-team-autoservice.176.112.158.15.sslip.io:8080` (või teie määratud URL)
- **Rakenduse aadress:** `http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/`

---

## 2. Ekraanipildid (E1 – E6)

### E1: Zabbix System Information
> *Reports → System information, kus on näha `Zabbix server is running: Yes`.*

![E1 - System Information](./screenshots/E1_system_information.png)

---

### E2: Veebistsenaariumi olek
> *Monitoring → Hosts → Web vaade, kus veebistsenaariumi staatus on `OK` ja vastamisaeg nähtav.*

![E2 - Web Scenario OK](./screenshots/E2_web_scenario.png)

---

### E3: Rakenduse vastamisaja graafik
> *Monitoring → Latest data → `web.test.time` graafik pärast vähemalt 10-minutilist seiret.*

![E3 - Response Time Graph](./screenshots/E3_response_time_graph.png)

---

### E4: Aktiivne häire (Problems vaade)
> *Monitoring → Problems vaade, kus on näha aktiivne probleem `Rakendus ei vasta` (ja trigger dependency tõttu EI OLE teist häiret `Rakendus on aeglane`).*

![E4 - Problems View](./screenshots/E4_problem_active.png)

---

### E5: Teavitused kanalis (Discord / Telegram)
> *Kanalisse saabunud teated: esmalt `PROBLEM: Rakendus ei vasta` ja pärast taaskäivitust `RESOLVED: Rakendus ei vasta`.*

![E5 - Notification](./screenshots/E5_notifications.png)

---

### E6: SLA Aruanne pärast seisakut
> *Services → SLA report vaade, mis kajastab pärast 3-minutilist seisakut arvutatud SLI väärtust ja kahanenud/ületatud Error budgetit.*

![E6 - SLA Report](./screenshots/E6_sla_report.png)

---

## 3. Vastused küsimustele (K1 – K8)

### K1. Mis on teie rakenduse keskmine vastamisaeg? Kas see on hea?
**Vastus:** Meie rakenduse keskmine vastamisaeg on ligikaudu **0,15 – 0,30 sekundit (150–300 ms)**. Vastavalt antud skaalale (alla 0,5 s on väga hea) on see tulemus **väga hea**. Tulemus on kiire, kuna React frontend kompileeritakse staatiliseks paketiks ja Nginx serveerib seda minimaalse latentsusega.

### K2. Veebistsenaarium kontrollib ainult avalehte. Nimetage üks teie rakenduse funktsioon, mis võib olla katki nii, et avaleht ikka avaneb. Kuidas seda kontrollida?
**Vastus:** Katki võib olla **PocketBase andmebaasi backend või autentimissüsteem** (nt broneeringute salvestamine või kasutaja sisselogimine). Kuna React SPA laadib staatilise HTML-kesta brauserisse veatult (kood 200), avaneb avaleht isegi siis, kui andmebaas või REST API on maas.  
*Kuidas kontrollida:* Veebistsenaariumile saab lisada sammu **Step 2**, mis teeb otse HTTP GET päringu PocketBase tervisekontrolli või kirjete otspunktile (näiteks `http://<pocketbase-url>/api/health` või `/api/collections/bookings/records`) ja kontrollib HTTP koodi 200 ning nõutud JSON vastust.

### K3. Mitu minutit läks rakenduse peatamisest kuni teateni? Millest see aeg koosneb?
**Vastus:** Rakenduse peatamisest teate saabumiseni Discordi/Telegrami läks ligikaudu **1–2 minutit**.  
See aeg koosneb kolmest osast:
1. **Update interval (1m):** Zabbix sooritab veebipäringu kindla intervalliga kord minutis.
2. **Triggeri hindamisaken (`min(..., 1m) > 0`):** Tingimus kontrollib, et viimase 1 minuti jooksul ei olnud ühtegi edukat vastust.
3. **Teavituse viide (Action execution delay):** Ajavahemik tegevuse käivitamisest, webhooki/boti väljakutsest kuni sõnumi ilmumiseni sihtkanalis (mõned sekundid).

### K4. Miks oli vaja sõltuvust (dependency)? Kirjeldage oma sõnadega, mis juhtuks ilma selleta.
**Vastus:** Sõltuvus (*trigger dependency*) hoiab ära liigsete ja eksitavate teavituste saatmise. Kui server või rakendus on täielikult maas, saabub päringutele timeout (15 s), mis ületab ka kiiruse lävendi (> 2 s). Ilma sõltuvuseta saaks administraator korraga **kaks eraldi häiret**: *"Rakendus ei vasta"* ja *"Rakendus on aeglane"*. Sõltuvus ütleb Zabbixile, et kui peamine kriitiline probleem ("ei vasta") on aktiivne, tuleb teisejärguline hoiatus ("on aeglane") vaigistada.

### K5. Nimetage kaks asja, mis tekitavad häireväsimust (alert fatigue), ja kuidas neid vältida.
**Vastus:**
1. **Liiga madalad/tundlikud lävendid ja hetkeliste anomaaliate häirestamine:** Kui häire saadetakse iga üksiku sekundilise võrgukõikumise peale. *Vältimine:* Kasutada libisevaid keskmisi või ajalisi aknaid (nt `avg(..., 5m) > 2s`), mis filtreerivad välja lühiajalised mittemääravad piigid.
2. **Liiga palju ebaolulisi (mitte-kriitilisi) teavitusi samas kanalis:** Kui operaatori kanalisse tulevad segamini info-, hoiatuse- ja katastroofiteated. *Vältimine:* Severity tasemete korrektne häälestamine ja ainult reaalset sekkumist vajavate häirete (High, Disaster) suunamine otsestesse valvekanalitesse (SMS/Discord).

### K6. Kui suur on veaeelarve (error budget) minutites SLO 99,9% juures — ühe päeva kohta ja ühe kuu kohta?
**Vastus:**
- **Ühe päeva kohta (24 tundi):**
  $$24 \times 60 \text{ min} \times (100\% - 99,9\%) = 1440 \times 0,001 = \mathbf{1,44 \text{ minutit}} \approx \mathbf{1 \text{ min 26 sek}}.$$
- **Ühe kuu kohta (30 päeva):**
  $$30 \times 24 \times 60 \text{ min} \times 0,001 = 43\,200 \times 0,001 = \mathbf{43,2 \text{ minutit}} \approx \mathbf{43 \text{ min 12 sek}}.$$
*Võrdlus Zabbixi numbriga:* Zabbixi 1-päevase aruande veaeelarve näitab alguses samuti väärtust ~1m 26s.

### K7. Mis oli teie SLI pärast 3-minutilist seisakut? Kas päeva SLO on täidetud? Kas kuu SLO oleks täidetud?
**Vastus:**
- **Arvutuslik SLI päeva lõikes (24h = 1440 min):**
  $$\text{SLI} = \frac{1440 - 3}{1440} \times 100\% = \frac{1437}{1440} \times 100\% \approx \mathbf{99,79\%}.$$
- **Kas päeva SLO (99,9%) on täidetud?** **EI ole täidetud**, sest mõõdetud 99,79% jääb alla lubatud 99,9% piiri ja päevane veaeelarve (1,44 min) kulutati täielikult ära ning läks miinusesse.
- **Kas kuu SLO (99,9%) oleks täidetud?** **JAH oleks**, sest kuu lubatud seisakuaeg on 43,2 minutit. 3-minutiline seisak moodustab sellest alla 7%, seega kuu kogueelarve jääb tugevalt plussi ($99,993\% > 99,9\%$).

### K8. Millal on õige kasutada Excluded downtimes ja millal see oleks kliendi petmine?
**Vastus:**
- **Õige kasutada:** Etteteatatud ja lepinguliselt kokkulepitud plaaniliste hooldusakende (*maintenance windows*) ajal — näiteks madala liiklusega ajal (nt pühapäeva öösel kl 03:00–05:00), millest kliente on ette teavitatud ja mille eesmärk on süsteemi turvauuendused või riistvara hooldus.
- **Kliendi petmine:** Ootamatute rikete, administraatorite vigade, süsteemi ülekoormuse või katkestuste tagantjärele märkimine "hoolduseks", et kunstlikult ilustada SLA statistikat ja pääseda lepingujärgsete trahvide või hüvitiste maksmisest.

---

## 4. Kokkuvõte

Käesoleva seirepraktikumi käigus ehitasime Coolify platvormile Zabbixil põhineva tervikliku monitooringulahenduse AutoServicePro veebirakendusele. Kõige kasulikum oli praktiliselt läbi teha seose loomine tooreste tehniliste mõõdikute (HTTP kood ja vastamisaeg), häiresõltuvuste ning äriliste SLA/SLO ja veaeelarve (Error Budget) vahel. Kõige keerulisemaks osutus alguses tagide ja teenuste sidumine Zabbixi hierarhias, kus sildid peavad täpselt ühtima, et SLA aruanne andmeid kuvaks. Samuti oli õpetlik näha, kuidas triggerite sõltuvus (*dependency*) hoiab ära topelthäirete laviini süsteemi maasoleku ajal. Päris tootmiskeskkonnas lisaksime kindlasti lisasammudena sügavamad tervisekontrollid (näiteks andmebaasi päringu edukus ja Stripe integratsiooni saadavus), automaatsed taaskäivituse skriptid ning eristaksime teavituste kanalid tõsidusastme järgi (kriitilised häired SMS/PagerDuty, hoiatused tavalisse vestluskanalisse).
