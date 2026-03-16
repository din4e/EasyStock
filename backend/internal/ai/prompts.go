package ai

// Prompt templates for different recognition scenarios
// All prompts are in Chinese for better Chinese product/receipt recognition

const (
	// Product recognition prompt - for product photos
	PromptProduct = `你是一个专业的库存物品识别助手。请分析这张商品照片，提取以下信息：

请以JSON数组格式返回识别结果，每个物品包含以下字段：
- name: 物品名称（必填）
- barcode: 条形码（如果可见）
- quantity: 数量（默认为1）
- unit: 单位（如：个、盒、箱、瓶、袋等）
- price: 售价（如果可见）
- cost: 成本价（如果可见）
- expired_at: 过期日期（YYYY-MM-DD格式，如果可见）
- description: 商品描述
- category: 建议分类（如：食品、饮料、日用品、办公用品等）
- brand: 品牌（如果可见）
- confidence: 识别置信度（0-1之间的数值）

注意：
1. 只返回JSON数组，不要包含其他解释文字
2. 如果无法识别某个字段，可以省略或设为null
3. 置信度表示对识别结果的确信程度
4. 如果图片中有多件商品，请分别识别`

	// Receipt recognition prompt - for receipts and invoices
	PromptReceipt = `你是一个专业的购物小票/发票识别助手。请分析这张小票/发票图片，提取购买的商品信息：

请以JSON数组格式返回识别结果，每个物品包含以下字段：
- name: 商品名称（必填）
- barcode: 商品编码（如果有）
- quantity: 购买数量
- unit: 单位
- price: 单价
- cost: 单价（成本）
- expired_at: 过期日期（如果有）
- description: 商品描述
- category: 商品分类
- brand: 品牌
- confidence: 识别置信度（0-1之间的数值）

注意：
1. 只返回JSON数组，不要包含其他解释文字
2. 小票上的每个商品项目都需要识别
3. 数量和价格要准确
4. 如果有促销折扣，请在价格中反映实际支付金额
5. 忽略小票头部信息和支付汇总信息`

	// Barcode recognition prompt - for barcode images
	PromptBarcode = `你是一个条形码识别助手。请分析这张图片中的条形码：

请以JSON数组格式返回识别结果：
- name: 根据条形码推测的商品名称（如果可能）
- barcode: 条形码数字
- quantity: 默认为1
- confidence: 识别置信度（0-1之间的数值）

注意：
1. 只返回JSON数组，不要包含其他解释文字
2. 如果无法识别条形码，confidence设为较低的值
3. 如果能根据条形码推测商品类型，请在name和category中体现`

	// PDF recognition prompt - for PDF documents
	PromptPDF = `你是一个专业的文档识别助手。请分析这份PDF文档，提取其中的物品信息：

请以JSON数组格式返回识别结果，每个物品包含以下字段：
- name: 物品名称（必填）
- barcode: 编码（如果有）
- quantity: 数量
- unit: 单位
- price: 价格
- cost: 成本
- expired_at: 过期日期（如果有）
- description: 描述
- category: 分类
- brand: 品牌
- confidence: 识别置信度（0-1之间的数值）

注意：
1. 只返回JSON数组，不要包含其他解释文字
2. 识别文档中的所有物品条目
3. 对于表格数据，按行提取每个物品`
)

// GetPrompt returns the appropriate prompt for the recognition type
func GetPrompt(recType RecognitionType) string {
	switch recType {
	case RecognitionTypeProduct:
		return PromptProduct
	case RecognitionTypeReceipt:
		return PromptReceipt
	case RecognitionTypeBarcode:
		return PromptBarcode
	default:
		return PromptProduct
	}
}
