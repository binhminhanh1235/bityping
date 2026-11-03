import { parseCards } from '../../shared/parseCards.js';

export const STARTER_MICROSERVICES_MD = `---
topic: Microservices
tags: [saga, distributed, pattern]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch cục bộ cập nhật cơ sở dữ liệu và phát sinh sự kiện để kích hoạt bước tiếp theo.

en: If a step fails, the saga [runs]{1} [compensating transactions]{2}.
vi: Nếu một bước thất bại, saga sẽ [chạy]{1} [các giao dịch bù trừ]{2}.
note: Giao dịch bù trừ sẽ đảo ngược các thay đổi đã thực hiện trước đó để bảo toàn tính nhất quán.

en: The [outbox pattern]{1} ensures [reliable event publishing]{2} across microservices.
vi: [Mô hình outbox]{1} đảm bảo [việc phát sự kiện đáng tin cậy]{2} giữa các vi dịch vụ.
note: Lưu sự kiện vào cùng database transaction của nghiệp vụ trước khi đẩy lên message broker.

en: An [API gateway]{1} acts as a [single entry point]{2} for all incoming client requests.
vi: Một [cổng API]{1} đóng vai trò là [điểm vào duy nhất]{2} cho tất cả yêu cầu từ máy khách.
note: Giúp xử lý xác thực, giới hạn tốc độ (rate limiting) và định tuyến request.

en: The [circuit breaker]{1} pattern prevents a failing service from [cascading]{2} system-wide.
vi: Mô hình [ngắt mạch]{1} ngăn chặn một dịch vụ bị lỗi [gây ảnh hưởng dây chuyền]{2} toàn hệ thống.
note: Có 3 trạng thái chính: Closed (đóng), Open (mở ngắt kết nối) và Half-Open (thử nghiệm phục hồi).

en: [Idempotency]{1} guarantees that repeating an operation produces the [same result]{2}.
vi: [Tính bất biến kết quả]{1} đảm bảo việc lặp lại một thao tác sẽ cho ra [cùng một kết quả]{2}.
note: Cực kỳ quan trọng khi xử lý cơ chế retry và thanh toán qua mạng.

en: [Event sourcing]{1} persists the state as an [append-only log]{2} of historical changes.
vi: [Event sourcing]{1} lưu trữ trạng thái dưới dạng một [nhật ký chỉ thêm]{2} các thay đổi lịch sử.
note: Cho phép tái hiện lại trạng thái của hệ thống tại bất kỳ thời điểm nào trong quá khứ.
`;

export const STARTER_SYSTEM_DESIGN_MD = `---
topic: System Design
tags: [architecture, scalability, performance]
level: B2
---

en: A [load balancer]{1} distributes incoming traffic evenly across [multiple servers]{2}.
vi: Một [bộ cân bằng tải]{1} phân phối lưu lượng truy cập đồng đều qua [nhiều máy chủ]{2}.
note: Giúp loại bỏ điểm nghẽn đơn lẻ (single point of failure) và tăng tính khả dụng.

en: A [cache hit]{1} serves requested data directly from [memory]{2} without querying the database.
vi: Một [lần trúng bộ đệm]{1} cung cấp dữ liệu được yêu cầu trực tiếp từ [bộ nhớ]{2} mà không cần truy vấn cơ sở dữ liệu.
note: Giảm đáng kể độ trễ phản hồi và giảm tải cho hệ thống lưu trữ.

en: [Database sharding]{1} splits a huge dataset horizontally across [several database nodes]{2}.
vi: [Phân mảnh cơ sở dữ liệu]{1} chia tách một tập dữ liệu khổng lồ theo chiều ngang qua [nhiều nút cơ sở dữ liệu]{2}.
note: Mỗi phân mảnh (shard) chứa một tập con dữ liệu dựa trên khoá sharding key.

en: The [CAP theorem]{1} states that a distributed system can only provide [two of three guarantees]{2}.
vi: [Định lý CAP]{1} khẳng định rằng một hệ thống phân tán chỉ có thể cung cấp [hai trong ba bảo đảm]{2}.
note: Ba bảo đảm gồm: Tính nhất quán (Consistency), Tính khả dụng (Availability), và Khả năng chịu lỗi phân vùng (Partition tolerance).

en: A [rate limiter]{1} caps the number of requests a user can make within a [time window]{2}.
vi: Một [bộ giới hạn tốc độ]{1} khống chế số lượng yêu cầu mà người dùng có thể tạo trong một [cửa sổ thời gian]{2}.
note: Bảo vệ hạ tầng khỏi tấn công từ chối dịch vụ (DoS) và tình trạng cạn kiệt tài nguyên.

en: A [CDN]{1} caches static assets near the user to achieve [minimal latency]{2}.
vi: Một [mạng phân phối nội dung]{1} lưu tạm tài nguyên tĩnh gần người dùng để đạt [độ trễ tối thiểu]{2}.
note: CDN sử dụng mạng lưới các máy chủ biên (edge servers) trải rộng toàn cầu.

en: [Consistent hashing]{1} minimizes key remapping when servers are [added or removed]{2}.
vi: [Băm nhất quán]{1} giảm thiểu việc ánh xạ lại khoá khi các máy chủ được [thêm vào hoặc gỡ bỏ]{2}.
note: Rất hữu ích trong việc xây dựng hệ thống caching phân tán như Memcached hoặc DynamoDB.
`;

/**
 * Danh sách starter packs đã parse sẵn
 */
export function getStarterPacks() {
  const p1 = parseCards(STARTER_MICROSERVICES_MD);
  const p2 = parseCards(STARTER_SYSTEM_DESIGN_MD);

  return [
    {
      id: 'starter-microservices',
      topic: p1.meta.topic,
      tags: p1.meta.tags,
      level: p1.meta.level,
      cards: p1.cards,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'starter-system-design',
      topic: p2.meta.topic,
      tags: p2.meta.tags,
      level: p2.meta.level,
      cards: p2.cards,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ];
}
