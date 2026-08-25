import { describe, it, expect } from 'vitest';
import { cleanSupplierDescription } from '@/features/hotels/lib/clean-description';

/** The description that prompted this, verbatim from the property page. */
const SEVEN_HOSTEL =
    '«Seven Hostel» is located in Seoul. This hostel is located In 4 km from the city center. ' +
    'You can take a walk and explore the neighbourhood area of the hostel — Seogang University, ' +
    'Seoul and Deoksugung Palace.,In the shared kitchen, you can cook anything you want. ' +
    'Want to be always on-line? Wi-Fi is available. If you travel by car, you can park in a paid ' +
    "parking zone. At the guests' disposal, there's also a laundry.,In the room, for you, there is " +
    'a TV. Please note that the listed services may not be available in all the rooms.,' +
    'No-show availability: unspecified. No-show day period: unspecified. No-show time: ,' +
    'Visa support: No information on the Visa support, Number of rooms: 20., Frequency: 60., ' +
    'Voltage: 220., Sockets: Type c. Type f.';

describe('cleanSupplierDescription', () => {
    it('drops the facts block off the end', () => {
        const out = cleanSupplierDescription(SEVEN_HOSTEL);
        for (const junk of ['No-show', 'Visa support', 'Number of rooms', 'Voltage', 'Sockets', 'Frequency']) {
            expect(out).not.toContain(junk);
        }
    });

    it('splits the run-on sections into paragraphs', () => {
        const out = cleanSupplierDescription(SEVEN_HOSTEL);
        const paragraphs = out.split('\n\n');
        expect(paragraphs).toHaveLength(3);
        expect(paragraphs[0]).toMatch(/^Seven Hostel is located in Seoul\./);
        expect(paragraphs[1]).toMatch(/^In the shared kitchen/);
        expect(paragraphs[2]).toMatch(/^In the room, for you, there is a TV\./);
        // The seam is gone, not merely hidden.
        expect(out).not.toContain('.,');
    });

    it('keeps every word of the prose it was given', () => {
        const out = cleanSupplierDescription(SEVEN_HOSTEL);
        expect(out).toContain('Seogang University, Seoul and Deoksugung Palace.');
        expect(out).toContain('Wi-Fi is available.');
        expect(out).toContain('may not be available in all the rooms.');
    });

    it('drops the guillemets around the property name', () => {
        const out = cleanSupplierDescription(SEVEN_HOSTEL);
        expect(out).not.toContain('«');
        expect(out).not.toContain('»');
        expect(out).toContain('Seven Hostel is located in Seoul.');
    });

    it('leaves ordinary English quotation alone', () => {
        // Only the angle pairs go. Curly doubles are English punctuation, and a
        // description is allowed to quote something.
        const quoted = 'The owners call it “the little house by the sea”.';
        expect(cleanSupplierDescription(quoted)).toBe(quoted);
    });

    it('leaves the supplier own grammar alone', () => {
        // "located In 4 km" is wrong, and it is the supplier's wrong. Guessing
        // at prose is how a cleaner starts mangling copy that was fine.
        expect(cleanSupplierDescription(SEVEN_HOSTEL)).toContain('located In 4 km');
    });

    it('leaves a well-formed description untouched', () => {
        const clean = 'A quiet hotel by the river. Breakfast is served until 10am.';
        expect(cleanSupplierDescription(clean)).toBe(clean);
    });

    it('does not cut on a comma that is ordinary prose', () => {
        const prose = 'Close to the station, the museum and the park. Rooms face the courtyard.';
        expect(cleanSupplierDescription(prose)).toBe(prose);
    });

    it('cuts a facts run that follows prose with no seam', () => {
        const out = cleanSupplierDescription('A small guesthouse in the old town. Voltage: 220. Sockets: Type c.');
        expect(out).toBe('A small guesthouse in the old town.');
    });

    it('keeps the original rather than showing nothing', () => {
        // All facts and no prose: still more use than a blank space.
        const factsOnly = 'Voltage: 220., Sockets: Type c. Type f.';
        expect(cleanSupplierDescription(factsOnly)).toBe(factsOnly);
    });

    it('handles nothing at all', () => {
        expect(cleanSupplierDescription(null)).toBe('');
        expect(cleanSupplierDescription(undefined)).toBe('');
        expect(cleanSupplierDescription('   ')).toBe('');
    });
});
