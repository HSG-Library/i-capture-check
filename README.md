# iCapture Check
Umsetzung der Dublettenprüfung für Inhaltsverzeichnisse vor dem Scan mit iCapture.

## Allgemeine Infos
Einführung aus der Spezifikation:
> Bevor Inhaltsverzeichnisse gescannt werden, muss überprüft werden, ob bereits eine andere Bibliothek in SLSP das Inhaltsverzeichnis gescannt hat. Dazu braucht es eine Abfrage, welche zurückmeldet, ob für den Titel in Alma bereits ein bestimmtes Feld mit den Begriffen "Inhaltsverzeichnis" oder "Table of contents" o.ä. vorhanden ist. Als Eingabe wird in der Regel der Exemplarstrichcode verwendet (mit Handscanner einlesen). In seltenen Fällen kann jedoch nicht mit dem Exemplarstrichcode gearbeitet werden. Dann muss die Systemnummer (MMS-ID) händisch eingetippt werden.

Siehe Spezifikation: https://gist.github.com/systemlibrarian/dd23ca796f3fae9fe58ebaa337ee4342

URL Umsetzung IT: https://tools.unisg.ch/handlers/public/exporticapture.ashx?shelf_mark=[barcode]
Beispiel: https://tools.unisg.ch/handlers/public/exporticapture.ashx?shelf_mark=HM00673466

Resultat:
```xml
<cata>
	<success>true</success>
	<shelf_mark>HM00673469</shelf_mark>
	<sys_nr>9911105508105506</sys_nr>
	<title>Stasis der Bürgerkrieg als politisches Paradigma</title>
	<author>Agamben, Giorgio</author>
	<author>Hack, Michael</author>
	<isbn>3100024524</isbn>
	<isbn>9783100024527</isbn>
	<language>ger</language>
	<duplicateInformation>https://deposit.dnb.de/cgi-bin/dokserv?id=2bed5aca0e2c4042aad532c86bf364de&prov=M&dok_var=1&dok_ext=htm Inhaltstext Titelblatt und Inhaltsverzeichnis PDF https://urn.ub.unibe.ch/urn:ch:slsp:hsg:3100024524:ihv:pdf </duplicateInformation>
</cata>
```


## Abweichungen in der Umsetzung
- Autoren: die Autoren werden nicht wie beschrieben aus `bib_data/author`bezogen, sonden aus den Marc Datenfeldern 100 und 700, es werden alle Autoren ausgegeben
- ISBN: die ISBN Nummmern werden nicht wie beschrieben aus `bib_data/isbn` bezogen, sondern aus den Marc Datenfeldern 020, es werden alle ISBN Nummern ausgegeben
- Dublettenservice: die Felder `856$3` und `856$z` werden auf folgende Inhalte geprüft: `"Inhaltsverzeichnis", "Table of contents", "Indice", "Table des matières", "Indice dei contenuti"`


## Anwendung
1. Deno Runtime herunterladen und im Ordner `deno` ablegen
2. Damit Anfragen an die Alma API gemacht werden können, muss eine Datei mit Namen `apikey` mit einem gültigen API-Key als einzigen Ihnalt im Ordner abgelegt werden.
3. Der Server kann über die Datei `run.cmd` gestartet werden
4. Anleitung für Konfiguration in iCapture: https://teamspace.unisg.ch/verw/bi/wiki/Seiten/iCapture%20technische%20Dokumentation.aspx
5. Abfrage mit XML resultat: http://localhost:3000/?shelf_mark=[barcode]
6. Abfrage via Interface http://0.0.0.0:3000
