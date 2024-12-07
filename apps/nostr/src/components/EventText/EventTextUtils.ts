import cloneDeep from 'lodash/cloneDeep'
import type { EventExtended, ContentPart } from '@/types'
import { cutTextByLengthAndLine, getTextLines, getNpub } from '@/utils/utils'
import { POST_LINES_COUNT, POST_TEXT_LENGTH } from '@/app'

export const getReferenceName = (reference: any) => {
  const details = reference.profile_details
  const npub = getNpub(reference.profile.pubkey)
  const name = details.name || details.username || details.display_name || `${npub.slice(0, 15)}...`
  return `@${name}`
}

export const getPartsContentLength = (parts: ContentPart[]) => {
  return parts.reduce((acc, part) => acc + part.value.length, 0)
}

export const getPartsContentLengthByText = (parts: ContentPart[]) => {
  return parts.reduce((acc, part) => acc + part.textValue.length, 0)
}

export const getPartsContentLines = (parts: ContentPart[]) => {
  if (!parts.length) return 0
  return getTextLines(parts.map((part) => part.value).join('')).length
}

export const cutPartText = (rawText: string, parts: ContentPart[]) => {
  const lengthLimit = POST_TEXT_LENGTH - getPartsContentLength(parts)
  const linesLimit = POST_LINES_COUNT - getPartsContentLines(parts)
  if (lengthLimit < 0 || linesLimit < 0) return ''
  return cutTextByLengthAndLine(rawText, lengthLimit, linesLimit)
}

export const getSortedReferences = (event: EventExtended) => {
  const references = cloneDeep(event.references)
  const { content } = event

  if (!references) return []

  const cachedIndexes: number[] = []
  references.forEach((ref: any) => {
    const { text } = ref
    let index = content.indexOf(text)

    // handle multiple mentions of the same profile
    while (cachedIndexes.includes(index) && index !== -1) {
      index = content.indexOf(text, index + text.length)
    }

    ref.textIndex = index
    cachedIndexes.push(index)
  })

  references.sort((a: any, b: any) => {
    return a.textIndex - b.textIndex
  })

  return references
}

export const splitEventContentByParts = (event: EventExtended, toSlice: boolean) => {
  const parts: ContentPart[] = []
  let eventRestText = event.content

  try {
    getSortedReferences(event).forEach((reference: any) => {
      const refIndex = eventRestText.indexOf(reference.text)
      const beforeReferenceText = eventRestText.slice(0, refIndex)
      const partValue = toSlice ? cutPartText(beforeReferenceText, parts) : beforeReferenceText

      parts.push({ type: 'text', value: partValue, textValue: partValue })
      if (toSlice && partValue < beforeReferenceText) {
        throw new Error('Event content reached length limit')
      }

      const name = getReferenceName(reference)
      const npub = getNpub(reference.profile.pubkey)

      // we always try to add @username to the end of text if it's presented at the end
      // but for case when username is too long we throw an error and show "Show more" button
      if (toSlice && name.length >= POST_TEXT_LENGTH) {
        throw new Error('Event content reached length limit')
      }
      parts.push({ type: 'profile', value: name, textValue: reference.text, npub })

      eventRestText = eventRestText.slice(refIndex + reference.text.length)
    })
  } catch (e) {
    return parts
  }

  // handle the rest of the text after the last reference (user mention)
  const partValue = toSlice ? cutPartText(eventRestText, parts) : eventRestText
  parts.push({ type: 'text', value: partValue, textValue: partValue })

  return parts
}
