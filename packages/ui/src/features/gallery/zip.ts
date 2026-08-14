/**
 * A ZIP archive, written here rather than pulled in. The gallery asks one
 * thing of the format — hand several finished creations over as a single file
 * — and everything going in is already compressed, so entries are stored
 * whole rather than deflated. That leaves the short half of the spec: a header
 * before each file, a table of the same at the end, and a CRC over the bytes.
 *
 * No zip64, so an archive has to stay under 4GB. A selection big enough to
 * pass that would not survive being held by the browser anyway.
 */

export interface ZipFile {
    readonly name: string
    readonly blob: Blob
}

const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const END_RECORD_SIZE = 22

const LOCAL_SIGNATURE = 0x04_03_4b_50
const CENTRAL_SIGNATURE = 0x02_01_4b_50
const END_SIGNATURE = 0x06_05_4b_50

/** Stored, not deflated. */
const STORED = 0
/** Bit 11, which is what says the name below is UTF-8. */
const UTF8_FLAG = 0x08_00
/** 2.0 — the oldest version that reads everything written here. */
const VERSION = 20

const NAMES = new TextEncoder()

function buildCrcTable(): Uint32Array {
    const table = new Uint32Array(256)

    for (let index = 0; index < 256; index++) {
        let value = index

        for (let bit = 0; bit < 8; bit++) {
            value = (value & 1) === 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1
        }

        table[index] = value
    }

    return table
}

const CRC_TABLE = buildCrcTable()

/** The CRC-32 every reader checks each entry against. */
export function crc32(bytes: Uint8Array): number {
    let crc = 0xff_ff_ff_ff

    for (let index = 0; index < bytes.length; index++) {
        crc = (CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
    }

    return (crc ^ 0xff_ff_ff_ff) >>> 0
}

/** The two halves of a DOS timestamp, which is what ZIP dates every entry by. */
function dosStamp(at: Date): { readonly time: number; readonly date: number } {
    return {
        time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
        date: ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
    }
}

interface Entry {
    readonly name: Uint8Array
    readonly crc: number
    readonly size: number
    /** Where this entry's local header starts, which the table at the end points at. */
    readonly offset: number
}

type Stamp = ReturnType<typeof dosStamp>

/** What goes immediately before the file's own bytes. */
function localHeader(entry: Entry, stamp: Stamp): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(LOCAL_HEADER_SIZE + entry.name.length)
    const view = new DataView(header.buffer)

    view.setUint32(0, LOCAL_SIGNATURE, true)
    view.setUint16(4, VERSION, true)
    view.setUint16(6, UTF8_FLAG, true)
    view.setUint16(8, STORED, true)
    view.setUint16(10, stamp.time, true)
    view.setUint16(12, stamp.date, true)
    view.setUint32(14, entry.crc, true)
    view.setUint32(18, entry.size, true)
    view.setUint32(22, entry.size, true)
    view.setUint16(26, entry.name.length, true)
    header.set(entry.name, LOCAL_HEADER_SIZE)

    return header
}

/** The same entry again, in the table a reader opens the archive by. */
function centralHeader(entry: Entry, stamp: Stamp): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(CENTRAL_HEADER_SIZE + entry.name.length)
    const view = new DataView(header.buffer)

    view.setUint32(0, CENTRAL_SIGNATURE, true)
    view.setUint16(4, VERSION, true)
    view.setUint16(6, VERSION, true)
    view.setUint16(8, UTF8_FLAG, true)
    view.setUint16(10, STORED, true)
    view.setUint16(12, stamp.time, true)
    view.setUint16(14, stamp.date, true)
    view.setUint32(16, entry.crc, true)
    view.setUint32(20, entry.size, true)
    view.setUint32(24, entry.size, true)
    view.setUint16(28, entry.name.length, true)
    view.setUint32(42, entry.offset, true)
    header.set(entry.name, CENTRAL_HEADER_SIZE)

    return header
}

/** The last 22 bytes: where the table is, and how much of it there is. */
function endRecord(count: number, size: number, offset: number): Uint8Array<ArrayBuffer> {
    const record = new Uint8Array(END_RECORD_SIZE)
    const view = new DataView(record.buffer)

    view.setUint32(0, END_SIGNATURE, true)
    view.setUint16(8, count, true)
    view.setUint16(10, count, true)
    view.setUint32(12, size, true)
    view.setUint32(16, offset, true)

    return record
}

/**
 * The files as one archive. Read one at a time on purpose: the CRC wants the
 * bytes, but the archive can carry the blob itself, so nothing but the file
 * being checksummed is ever fully in memory.
 */
export async function zipStored(files: readonly ZipFile[], modifiedAt: Date): Promise<Blob> {
    const stamp = dosStamp(modifiedAt)
    const parts: BlobPart[] = []
    const entries: Entry[] = []
    let offset = 0

    for (const file of files) {
        const bytes = new Uint8Array(await file.blob.arrayBuffer())
        const entry: Entry = {
            name: NAMES.encode(file.name),
            crc: crc32(bytes),
            size: bytes.length,
            offset,
        }
        const header = localHeader(entry, stamp)

        parts.push(header, file.blob)
        entries.push(entry)
        offset += header.length + entry.size
    }

    const table = entries.map((entry) => centralHeader(entry, stamp))
    const tableSize = table.reduce((total, record) => total + record.length, 0)

    parts.push(...table, endRecord(entries.length, tableSize, offset))

    return new Blob(parts, { type: 'application/zip' })
}
