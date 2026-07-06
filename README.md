# iCapture Check

Umsetzung des Lookups und der Dublettenprüfung für Inhaltsverzeichnisse beim
Scannen mit iCapture.

## Allgemeine Infos

Für das Scannen von Inhaltsverzeichnissen mit der Software iCapture wird ein
Lookup benötigt. Dieser Lookup holt sich anhand eines Identifiers die von
iCapture benötigten Daten des vorliegendes Buches aus Alma (über SRU). In der
Regel handelt es sich beim Identifier um den Strichcode des Exemplars. Eine
Ausnahme davon bilden die Analytischen Aufnahmen. Dort wird die MMS-ID benötigt,
damit das Inhaltsverzeichnis an den richtigen Titeldatensatz angehängt wird.
Zusätzlich zum Lookup wird eine Dublettenprüfung benötigt. Bevor
Inhaltsverzeichnisse gescannt werden, muss geprüft werden, ob bereits eine
andere Bibliothek in SLSP das Inhaltsverzeichnis gescannt hat. Dazu braucht es
eine Abfrage, welche zurückmeldet, ob für den Titel in Alma bereits ein
bestimmtes Feld mit den Begriffen "Inhaltsverzeichnis" oder "Table of contents"
o.a. vorhanden ist.

Grundsätzlich bietet iCapture als "out-of-the-Box"-Lösung für den Lookup die
Möglichkeit eine SRU-Url zu hinterlegen. Dort kann jedoch nur entweder unsere
IZ-URL oder die NZ-URL von SLSP hinterlegt werden. Um die Möglichkeit zu haben,
sowohl Strichcode, IZ-MMSID als auch NZ-MMSID einzuscannen und ein Resultat zu
erhalten, wird die vorliegende Applikation gebraucht.

Die Applikation nimmt einen Identifier entgegen und prüft, ob es sich um einen
Strichcode, eine IZ-MMSID oder eine NZ-MMSID handelt, ruft die entsprechende
SRU-Query auf und gibt das Resultat als SRU-Response im MARCXML Format zurück.
Diese Response wird von iCapture weiterverarbeitet. Zusätzlich gibt es für die
Dublettenprüfung ein minimales Frontend, das nach dem Einscannen des Identifiers
anzeigt, ob bereits ein Inhaltsverzeichnis vorhanden ist. Dafür werden die
Felder `856$3` und `856$z` werden auf folgende Inhalte geprüft:
`"Inhaltsverzeichnis", "Table of contents", "Indice", "Table des matières", "Indice dei contenuti"`

## Anwendung

1. Deno Runtime herunterladen und im Ordner `deno` ablegen
2. Der Server kann über die Datei `run-in-background.cmd` gestartet werden
3. Anleitung für Konfiguration in iCapture:
   https://teamspace.unisg.ch/verw/bi/wiki/Seiten/iCapture%20technische%20Dokumentation.aspx
4. Abfrage mit XML resultat: http://localhost:3000/?shelf_mark=[barcode]
5. Abfrage via Interface http://localhost:3000
6. Alternativ kann im SRU-Stil abgefragt werden (wird für iCapture so benötigt):
   http://localhost:3000/?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=shelf_mark=[barcode]

## Beispiele

**Barcode:** http://localhost:3000/?shelf_mark=HM00673469

**Barcode (SRU-Style):**
http://localhost:3000/?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=shelf_mark=HM00673469

**MMSID aus IZ:** http://localhost:3000/?shelf_mark=9911105508105506

**MMSID aus NZ:** http://localhost:3000/?shelf_mark=991171868027605501
