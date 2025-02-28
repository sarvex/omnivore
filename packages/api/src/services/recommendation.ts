import { nanoid } from 'nanoid'
import { DeepPartial } from 'typeorm'
import { LibraryItem } from '../entity/library_item'
import { Recommendation } from '../entity/recommendation'
import { authTrx } from '../repository'
import { logger } from '../utils/logger'
import { createHighlights } from './highlights'
import { createLibraryItem, findLibraryItemByUrl } from './library_item'

export const addRecommendation = async (
  item: LibraryItem,
  recommendation: Recommendation,
  userId: string,
  highlightIds?: string[]
) => {
  try {
    // check if the item is already recommended to the group
    let recommendedItem = await findLibraryItemByUrl(item.originalUrl, userId)
    if (!recommendedItem) {
      // create a new item
      const newItem: DeepPartial<LibraryItem> = {
        user: { id: userId },
        slug: item.slug,
        title: item.title,
        author: item.author,
        description: item.description,
        originalUrl: item.originalUrl,
        originalContent: item.originalContent,
        contentReader: item.contentReader,
        directionality: item.directionality,
        itemLanguage: item.itemLanguage,
        itemType: item.itemType,
        readableContent: item.readableContent,
        siteIcon: item.siteIcon,
        siteName: item.siteName,
        thumbnail: item.thumbnail,
        uploadFile: item.uploadFile,
        wordCount: item.wordCount,
      }

      recommendedItem = await createLibraryItem(newItem, userId)
    }

    const highlights = item.highlights
      ?.filter((highlight) => highlightIds?.includes(highlight.id))
      .map((highlight) => ({
        shortId: nanoid(8),
        createdAt: new Date(),
        libraryItem: { id: recommendedItem?.id },
        user: { id: userId },
        quote: highlight.quote,
        annotation: highlight.annotation,
        prefix: highlight.prefix,
        suffix: highlight.suffix,
        patch: highlight.patch,
        updatedAt: new Date(),
        sharedAt: new Date(),
        html: highlight.html,
        color: highlight.color,
      }))
    if (highlights) {
      await createHighlights(highlights, recommendedItem.id, userId)
    }

    await createRecommendation(
      {
        ...recommendation,
        libraryItem: { id: recommendedItem.id },
      },
      userId
    )

    return recommendedItem
  } catch (err) {
    logger.error('Error adding recommendation', err)
    return null
  }
}

export const createRecommendation = async (
  recommendation: DeepPartial<Recommendation>,
  userId: string
) => {
  return authTrx(
    async (tx) => tx.getRepository(Recommendation).save(recommendation),
    undefined,
    userId
  )
}

export const findRecommendationsByLibraryItemId = async (
  libraryItemId: string,
  userId: string
) => {
  return authTrx(
    async (tx) =>
      tx.getRepository(Recommendation).find({
        where: { libraryItem: { id: libraryItemId } },
        relations: {
          group: true,
          recommender: true,
        },
      }),
    undefined,
    userId
  )
}
