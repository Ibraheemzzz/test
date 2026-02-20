/**
 * Pagination Helper Utility
 * Provides reusable pagination functionality for list endpoints
 */

/**
 * Parse pagination parameters from query
 * @param {Object} query - Express query object
 * @param {number} defaultLimit - Default items per page (default: 20)
 * @param {number} maxLimit - Maximum items per page (default: 100)
 * @returns {Object} Pagination parameters
 */
const getPaginationParams = (query, defaultLimit = 20, maxLimit = 100) => {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || defaultLimit;

  // Ensure page is at least 1
  if (page < 1) page = 1;

  // Ensure limit is within bounds
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
};

/**
 * Build pagination metadata
 * @param {number} totalItems - Total number of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const buildPaginationMeta = (totalItems, page, limit) => {
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null
  };
};

/**
 * Build paginated response
 * @param {Array} items - Array of items for current page
 * @param {number} totalItems - Total number of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Paginated data structure
 */
const buildPaginatedResponse = (items, totalItems, page, limit) => {
  return {
    items,
    pagination: buildPaginationMeta(totalItems, page, limit)
  };
};

/**
 * Build SQL LIMIT and OFFSET clause
 * @param {number} limit - Items per page
 * @param {number} offset - Offset
 * @returns {string} SQL clause
 */
const buildPaginationClause = (limit, offset) => {
  return `LIMIT ${limit} OFFSET ${offset}`;
};

/**
 * Build sorting clause for SQL
 * @param {Object} query - Express query object
 * @param {string} defaultSort - Default sort column
 * @param {string} defaultOrder - Default sort order (ASC/DESC)
 * @param {Array} allowedSortFields - List of allowed sort fields
 * @returns {Object} Sort parameters
 */
const getSortParams = (query, defaultSort = 'created_at', defaultOrder = 'DESC', allowedSortFields = []) => {
  let sortBy = query.sort || defaultSort;
  let sortOrder = (query.order || defaultOrder).toUpperCase();

  // Validate sort order
  if (!['ASC', 'DESC'].includes(sortOrder)) {
    sortOrder = defaultOrder;
  }

  // Validate sort field if allowed fields are specified
  if (allowedSortFields.length > 0 && !allowedSortFields.includes(sortBy)) {
    sortBy = defaultSort;
  }

  return {
    sortBy,
    sortOrder,
    sortClause: `ORDER BY ${sortBy} ${sortOrder}`
  };
};

/**
 * Build search filter for SQL queries
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {Object} Search parameters with clause and params
 */
const buildSearchFilter = (searchTerm, searchFields) => {
  if (!searchTerm || searchFields.length === 0) {
    return {
      searchClause: '',
      searchParams: []
    };
  }

  const likeConditions = searchFields.map(field => `${field} ILIKE $`);
  const searchClause = `(${likeConditions.join(' OR ')})`;
  const searchParams = searchFields.map(() => `%${searchTerm}%`);

  return {
    searchClause,
    searchParams
  };
};

module.exports = {
  getPaginationParams,
  buildPaginationMeta,
  buildPaginatedResponse,
  buildPaginationClause,
  getSortParams,
  buildSearchFilter
};
