# 操作层代码参考

## 1. 图片生成 (image:generate)

### API 调用
- 端点：POST /api/v1/generate
- Content-Type: application/json

### 参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 图片描述 |
| negative_prompt | string | 否 | 负面提示词 |
| width | number | 否 | 宽度 (默认 1024) |
| height | number | 否 | 高度 (默认 1024) |
| num_images | number | 否 | 生成数量 (1-4) |
| style | string | 否 | 风格预设 |

### 输出
- Binary Data: 生成的图片
- JSON: { taskId, status, imageUrl }

### n8n 参数定义
```typescript
export const generateImageFields: INodeProperties[] = [
  {
    displayName: 'Prompt',
    name: 'prompt',
    type: 'string',
    typeOptions: { rows: 4 },
    default: '',
    required: true,
    displayOptions: {
      show: { resource: ['image'], operation: ['generate'] },
    },
    description: '描述要生成的图片内容',
  },
  {
    displayName: 'Additional Options',
    name: 'additionalOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: { resource: ['image'], operation: ['generate'] },
    },
    options: [
      {
        displayName: 'Negative Prompt',
        name: 'negative_prompt',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Width',
        name: 'width',
        type: 'number',
        default: 1024,
        typeOptions: { minValue: 256, maxValue: 2048 },
      },
      {
        displayName: 'Height',
        name: 'height',
        type: 'number',
        default: 1024,
        typeOptions: { minValue: 256, maxValue: 2048 },
      },
      {
        displayName: 'Number of Images',
        name: 'num_images',
        type: 'number',
        default: 1,
        typeOptions: { minValue: 1, maxValue: 4 },
      },
    ],
  },
];
```

---

## 2. 背景移除 (image:removeBackground)

### API 调用
- 端点：POST /api/v1/remove-bg
- Content-Type: multipart/form-data 或 application/json

### 参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image_url | string | 二选一 | 图片 URL |
| image | binary | 二选一 | 图片文件 |
| output_format | string | 否 | 输出格式 (png/webp) |

### n8n 参数定义
```typescript
export const removeBackgroundFields: INodeProperties[] = [
  {
    displayName: 'Input Method',
    name: 'inputMethod',
    type: 'options',
    options: [
      { name: 'URL', value: 'url' },
      { name: 'Binary Data', value: 'binary' },
    ],
    default: 'url',
    displayOptions: {
      show: { resource: ['image'], operation: ['removeBackground'] },
    },
  },
  {
    displayName: 'Image URL',
    name: 'imageUrl',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['image'],
        operation: ['removeBackground'],
        inputMethod: ['url'],
      },
    },
  },
  {
    displayName: 'Binary Property',
    name: 'binaryProperty',
    type: 'string',
    default: 'data',
    displayOptions: {
      show: {
        resource: ['image'],
        operation: ['removeBackground'],
        inputMethod: ['binary'],
      },
    },
  },
];
```

---

## 3. 提示词增强 (prompt:enhance)

### API 调用
- 端点：POST /api/v1/enhance-prompt
- Content-Type: application/json

### 参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 原始提示词 |
| style | string | 否 | 目标风格 |
| language | string | 否 | 输出语言 |

### 输出
- JSON: { enhanced_prompt, suggestions[] }

---

## 4. 虚拟试穿 (virtualTryOn:generate)

### API 调用
- 端点：POST /api/v1/virtual-tryon
- Content-Type: application/json 或 multipart/form-data

### 参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| person_image | string/binary | 是 | 人物图片 |
| garment_image | string/binary | 是 | 服装图片 |
| category | string | 否 | 服装类别 (upper/lower/full) |

### n8n 参数定义
```typescript
export const virtualTryOnFields: INodeProperties[] = [
  {
    displayName: 'Person Image URL',
    name: 'personImageUrl',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: { resource: ['virtualTryOn'], operation: ['generate'] },
    },
  },
  {
    displayName: 'Garment Image URL',
    name: 'garmentImageUrl',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: { resource: ['virtualTryOn'], operation: ['generate'] },
    },
  },
  {
    displayName: 'Category',
    name: 'category',
    type: 'options',
    options: [
      { name: 'Upper Body', value: 'upper' },
      { name: 'Lower Body', value: 'lower' },
      { name: 'Full Body', value: 'full' },
    ],
    default: 'upper',
    displayOptions: {
      show: { resource: ['virtualTryOn'], operation: ['generate'] },
    },
  },
];
```
