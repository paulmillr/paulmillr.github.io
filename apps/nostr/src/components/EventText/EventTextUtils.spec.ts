import { describe, it, expect } from 'vitest'
import { splitEventContentByParts } from './EventTextUtils'
import {
  shortContentEvent,
  longContentEvent,
  shortContentEventWithReferenceOnEnd,
  shortContentEventWithReferenceOnMiddle,
  shortContentEventWithReferencesOnStart,
  shortContentEventWithTwoReferences,
} from './mockData'
import type { EventExtended } from '@/types'
import { cutTextByLength } from '@/utils/utils'

describe('EventTextUtils: split content to parts', () => {
  it('short text, no slice, no references', () => {
    const toSliceContent = false
    const event = shortContentEvent
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    expect(parts).toEqual([{ type: 'text', value: event.content, textValue: event.content }])
  })

  it('short text, slice, no references', () => {
    const toSliceContent = true
    const event = shortContentEvent
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    expect(parts).toEqual([{ type: 'text', value: event.content, textValue: event.content }])
  })

  it('long text, no slice, no references', () => {
    const toSliceContent = false
    const event = longContentEvent
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    expect(parts).toEqual([{ type: 'text', value: event.content, textValue: event.content }])
  })

  it('long text, slice, no references', () => {
    const toSliceContent = true
    const event = longContentEvent
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    const slicedContent = cutTextByLength(event.content, 500)
    expect(parts).toEqual([{ type: 'text', value: slicedContent, textValue: slicedContent }])
  })

  it('short text, slice, 1 reference at the start of the string', () => {
    const toSliceContent = true
    const event = shortContentEventWithReferencesOnStart
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    const textParts = parts.filter((part) => part.type === 'text')
    const referenceParts = parts.filter((part) => part.type === 'profile')
    expect(parts.length).toEqual(3)
    expect(textParts.length).toEqual(2)
    expect(referenceParts.length).toEqual(1)
  })

  it('short text, slice, 1 reference on the middle of the string', () => {
    const toSliceContent = true
    const event = shortContentEventWithReferenceOnMiddle
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    const textParts = parts.filter((part) => part.type === 'text')
    const referenceParts = parts.filter((part) => part.type === 'profile')
    expect(parts.length).toEqual(3)
    expect(textParts.length).toEqual(2)
    expect(referenceParts.length).toEqual(1)
  })

  it('short text, slice, 1 reference at the end of the string', () => {
    const toSliceContent = true
    const event = shortContentEventWithReferenceOnEnd
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    const textParts = parts.filter((part) => part.type === 'text')
    const referenceParts = parts.filter((part) => part.type === 'profile')
    expect(parts.length).toEqual(3)
    expect(textParts.length).toEqual(2)
    expect(referenceParts.length).toEqual(1)
  })

  it('short text, slice, 2 references', () => {
    const toSliceContent = true
    const event = shortContentEventWithTwoReferences
    const parts = splitEventContentByParts(event as EventExtended, toSliceContent)
    const textParts = parts.filter((part) => part.type === 'text')
    const referenceParts = parts.filter((part) => part.type === 'profile')
    expect(parts.length).toEqual(5)
    expect(textParts.length).toEqual(3)
    expect(referenceParts.length).toEqual(2)
  })
})
