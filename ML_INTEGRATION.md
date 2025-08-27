# ML Integration for Transaction Processing

This document explains how to use the new ML-enhanced transaction processing features.

## Architecture Overview

The ML integration consists of several layers:

1. **ML Services Layer** (`src/lib/ml/`)
   - `preprocessor.ts`: Advanced text preprocessing with NLP
   - `classifier.ts`: Feature-based transaction categorization
   - `merchant-extractor.ts`: Enhanced merchant name extraction
   - `pipeline.ts`: Orchestrates all ML services with intelligent fallback

2. **Enhanced Parser Helpers** (`src/lib/parsers/helpers.ts`)
   - `convertToTransactionInterfaceML()`: ML-enhanced transaction processing
   - Maintains backward compatibility with rule-based system

3. **Updated ICICI Parser** (`src/lib/parsers/icici.ts`)
   - Supports both ML and rule-based processing
   - ML processing enabled by default with fallback

## How It Works

### 1. Text Preprocessing
- Uses `compromise.js` for advanced NLP tokenization
- Extracts meaningful features from transaction descriptions
- Creates feature vectors for ML classification

### 2. Transaction Classification
- Feature-based scoring system with pattern matching
- Combines ML predictions with rule-based validation
- Provides confidence scores and alternative categories

### 3. Merchant Extraction
- Multi-stage extraction: patterns → ML → fallback
- Enhanced normalization with business type detection
- Confidence-based selection of best extraction method

### 4. Intelligent Fallback
- Uses confidence thresholds to decide between ML and rules
- Graceful degradation when ML services fail
- Maintains data quality and processing reliability

## Usage Examples

### Basic ML Processing
```typescript
import { convertToTransactionInterfaceML } from '@/lib/parsers/helpers';

const transactions = await convertToTransactionInterfaceML(
  parsedTransactions,
  accountNumber,
  "ICICI"
);
```

### Custom ML Pipeline
```typescript
import { createMLPipeline } from '@/lib/ml/pipeline';

const pipeline = createMLPipeline({
  useML: true,
  confidenceThreshold: 0.7,
  fallbackToRules: true
});

const enrichment = await pipeline.enrichTransaction(
  description,
  amount,
  type
);
```

### Toggle ML Processing
```typescript
import { createIciciPdfParser } from '@/lib/parsers/icici';

// With ML (default)
const parserML = createIciciPdfParser(true);

// Rules only
const parserRules = createIciciPdfParser(false);
```

## Benefits

### Enhanced Accuracy
- Better merchant name extraction and normalization
- More accurate category classification
- Context-aware transaction analysis

### Intelligent Processing
- Confidence scoring for quality assurance
- Automatic fallback to proven rule-based system
- Hybrid approach combining ML and rules

### Improved Data Quality
- Enhanced tagging with ML insights
- Better detection of recurring transactions
- More detailed transaction notes and metadata

## Configuration

The ML system can be configured with these parameters:

```typescript
interface MLServiceConfig {
  useML: boolean;                    // Enable/disable ML processing
  confidenceThreshold: number;       // Minimum confidence (0-1)
  fallbackToRules: boolean;         // Use rules when ML confidence is low
  modelPath?: string;               // Future: custom model path
}
```

## Performance Notes

- ML processing is asynchronous and runs in parallel where possible
- First-time loading includes NLP library initialization
- Rule-based fallback ensures consistent performance
- Memory usage is optimized with lazy loading

## Future Enhancements

1. **Custom Model Training**: Train models on user transaction history
2. **Advanced NER**: Better entity recognition for merchants and locations  
3. **Anomaly Detection**: Flag unusual transactions for review
4. **Clustering**: Detect transaction patterns and recurring merchants
5. **Real-time Learning**: Continuously improve from user corrections

## Dependencies

- `@tensorflow/tfjs`: Machine learning framework
- `compromise`: Natural language processing
- `ml-matrix`: Mathematical operations
- Existing rule-based system for fallback

## Monitoring

The ML pipeline provides statistics and health information:

```typescript
const stats = pipeline.getStats();
console.log('ML Pipeline Status:', stats);
```

This shows which services are ready and overall system health.