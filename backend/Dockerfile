FROM golang:1.25-alpine AS builder

WORKDIR /app

# 构建依赖
RUN apk add --no-cache gcc musl-dev

# 利用 Docker 层缓存加速构建
COPY go.mod go.sum ./
RUN go mod download

# 复制源码并编译
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# 运行阶段：最小化镜像
FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /server .

# 创建数据和上传目录
RUN mkdir -p /app/data /app/data/uploads

EXPOSE 8080

CMD ["./server"]
