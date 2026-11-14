import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvObjects, detectDelimiter, CsvError } from '../src/js/core/csv.js';

test('einfache Zeilen, CRLF und abschließender Zeilenumbruch', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('Anführungszeichen mit Komma, doppeltem Quote und Zeilenumbruch', () => {
  const rows = parseCsv('x,y\n"a, b","sagt ""hallo""\nzweite Zeile"\n');
  assert.deepEqual(rows[1], ['a, b', 'sagt "hallo"\nzweite Zeile']);
});

test('BOM wird entfernt, leere Zeilen übersprungen, Zeilennummern stimmen', () => {
  const rows = parseCsv('﻿a,b\n\n"1\n1",2\n3,4');
  assert.deepEqual(rows, [['a', 'b'], ['1\n1', '2'], ['3', '4']]);
  assert.deepEqual(rows.map((r) => r.line), [1, 3, 5]);
});

test('Semikolon wird erkannt (Excel)', () => {
  assert.equal(detectDelimiter('a;b;"c,d"\n1;2;3'), ';');
  assert.equal(detectDelimiter('a,b;c,d'), ',');
  assert.deepEqual(parseCsv('a;b\n1,5;2'), [['a', 'b'], ['1,5', '2']]);
});

test('offenes Anführungszeichen wirft CsvError', () => {
  assert.throws(() => parseCsv('a,b\n"offen,2\n'), CsvError);
});

test('parseCsvObjects: Kopfzeile normalisiert, Werte getrimmt, Überlänge erkannt', () => {
  const { header, records } = parseCsvObjects(' ID , Name \n 1 , x ,zuviel\n2,y');
  assert.deepEqual(header, ['id', 'name']);
  assert.deepEqual(records[0], { id: '1', name: 'x' });
  assert.equal(records[0].extraFields, 1);
  assert.equal(records[1].extraFields, 0);
});
