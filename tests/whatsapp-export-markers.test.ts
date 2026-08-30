import { describe, expect, it } from 'vitest'

import {
  createWhatsAppExportMarkerModule,
  whatsAppExportMarkers
} from '../utils/whatsapp-export-markers'

describe('WhatsApp export marker module', () => {
  it('recognizes the configured marker shapes through one interface', () => {
    expect(whatsAppExportMarkers.match('<Médias omis>\nUne légende')).toEqual({
      kind: 'omitted-media',
      caption: 'Une légende'
    })
    expect(whatsAppExportMarkers.match('photo.jpg (fichier joint)\nUne légende')).toEqual({
      kind: 'attached-file',
      filename: 'photo.jpg',
      caption: 'Une légende'
    })
    expect(whatsAppExportMarkers.match('<pièce jointe: photo.jpg>')).toEqual({
      kind: 'attached-file',
      filename: 'photo.jpg',
      caption: null
    })
  })

  it('adds another language by extending only the marker registry', () => {
    const markers = createWhatsAppExportMarkerModule({
      omittedMedia: ['<Multimedia omitido>'],
      attachedFileSuffix: ['(archivo adjunto)'],
      attachedFileLabel: ['adjunto']
    })

    expect(markers.match('foto.jpg (archivo adjunto)\nMira esto')).toEqual({
      kind: 'attached-file',
      filename: 'foto.jpg',
      caption: 'Mira esto'
    })
    expect(
      markers.normalizeStoredMessage({
        text: '<Multimedia omitido>\nMira esto',
        mediaType: null
      })
    ).toEqual({ text: 'Mira esto', mediaType: 'image' })
    expect(markers.normalizeStoredPreview('(archivo adjunto)\nMira esto')).toBe('Mira esto')
  })
})
