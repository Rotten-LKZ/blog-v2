---
title: Rust：无畏并发
description: 无畏并发和基本并发模型说明，以及 Rust 中 Channel、Mutex 以及 Send Sync trait 基本讲解。
createdAt: 2026-10-27T08:59:00+08:00
updatedAt: 2026-10-27T15:00:04+08:00
tags: [Rust, Concurrency]
category: Tech
toc: true
---

Rust 没有将确保内存安全和避免并发错误视为两个问题，而是充分利用其所有权机制和类型系统让很多这类问题成为编译期问题，避免在运行时才能发现问题产生更大的影响。因此，与其让开发者花费许多时间去复现特殊场景下的错误，Rust 能够让这类错误禁止编译并且提供针对于错误的解释。这样开发者就只需要专注于修改代码本身而不是考虑代码在具体的运行环境不同而产生的不同问题。Rust 团队将这方面的 Rust 能力称为无畏并发（fearless concurrency）。无畏并发允许开发者在写代码的时候避免微妙的（subtle）错误以及在避免产生新错误的同时更简单地重构代码。

## 并发编程基础

并发（concurrency）：结构上同时处理多件事，单核也能并发。
并行（parallelism）：执行上同时跑多件事，靠的是 CPU 物理上的多核，是并发的子集。

并发要解决的是程序里会有等待的工作，并且并不是 CPU 密集型需要长期占用 CPU 的工作，譬如 I/O、定时器等。此时就有不同的解决方案，不同解决方案提供的模型本质上都是以什么样的方式在什么样的时机决定切换 CPU 执行的任务，同时解决任务之间如何交换数据。

### 1:1、M:N 模型

操作系统通常提供 API 能够创建线程，线程模型指的是用户态线程如何映射到内核态线程（OS 创建并且调度的线程）。线程模型有 1:1 模型（一个用户线程 = 一个内核线程，完全由操作系统调度）、N:1 模型（N 个用户线程泡在一个内核线程上，所有调度都靠程序本身自己调度）、M:N 模型（M个用户线程复用N个内核线程，语言或者程序本身内置调度器负责分发、抢占和阻塞切换，比如 Go 的 goroutine 其 GMP 模型）。

### 时间循环 + 状态机（async/await）

async/await、JavaScript 的 Promise 或者是在单片机 C 代码手动维护的这类异步本质上是一个状态机。但是这种实现一般都是在一条线程上进行，无法避免 CPU 密集型的工作占用线程导致无法正常进行时间循环。并且 `async` 会传染整个调用链。

### CSP 和 Actor 模型

这两种属于基于消息的并发模型，其就像是 Golang 的 channel 的“不要通过共享内存通信，要通过通信共享内存”思想。
Actor 模型中，主角是 Actor 本身，类似 worker，彼此之间直接发送信息，信息是异步发送和处理的。其规则为
- 每个 Actor 都有自己的私有状态，外部无法访问，并且在 Actor 内部是串行处理的
- Actor 之间只能异步发送信息，信息是不可变的拷贝或者数据的所有权转移
- Actor 可以响应信息，创建子 Actor，改变其内部状态
- Actor 可以阻塞自己，但不能阻塞运行它的线程
每一对 Actor 之间，都有一个 MailBox 来收发信息，信息的收发是异步的，也就是收发信息没有处理并不会阻塞 Actor 本身运行。

CSP（Communicating Sequential Processes）模型中，多个线程之间通过 Channel 通信，在 CSP 中 Channel 和发送方接收方解耦，本身只是一个匿名独立的管道，不需要确定对方是谁。并且 Channel 收发信息是同步的，比如 Golang 中的 chan，在不设置缓冲区的情况下没有接收方接受信息，发送方将阻塞；同理接收方一直没有收到信息也会阻塞接收方。而 MailBox 机制可以类似于一个无限缓冲区的 Channel，其不需要发送方或者接收方阻塞等待接收。

### 其他基本

- 同步原语：互斥锁、读写锁、条件变量、信号量、原子操作
- 内存模型：编译器和 CPU 都会重排指令，不能够通过代码中书写的顺序来保证机器运行的时候就一定按照顺序执行。使用 `volatile`、`原子变量`、`happens-before` 也需要小心并且正确理解其行为。
- 背压（backpressure）：比如有一个 CPU 密集型数据处理任务，只有两个并行处理的 worker。提供一个队列记录接下来要处理的任务，但是如果队列生产者快于消费者的时候队列会不断增长。内存却有限，不可能记录无限队列，也就是需要正确处理任务积压的问题。
- 死锁、竞态、活锁、ABA 问题

## threads 1:1 模型
使用 `std::thread::spawn` 可以创建一个线程，通过这种方式创建的线程是 1:1 线程，也就是操作系统创建、调用并且管理的。`spawn` 方法返回一个 `JoinHandle<T>`，其实现了一个 `join` 方法会阻塞直到里面记录的线程执行完毕。
```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..10 {
            println!("hi number {i} from the spawned thread!");
            thread::sleep(Duration::from_millis(1));
        }
    });

    for i in 1..5 {
        println!("hi number {i} from the main thread!");
        thread::sleep(Duration::from_millis(1));
    }

    handle.join().unwrap();
}
```
### move

如果想要在传给创建线程的闭包里面使用外部变量，比如以下代码使用 v（该代码编译不通过）。因为正常所有权在主线程，主线程可能随时会丢弃 v 或者对 v 进行改动之类，导致在新建线程里面使用 v 是不安全的。所以需要通过 move 关键字将 v 传入新建线程，这样主线程将不再拥有 v，`drop(v)` 就会提示所有权发生了转移
```rust
use std::thread;

fn main() {
    let v = vec![1, 2, 3];

    let handle = thread::spawn(|| {
        println!("Here's a vector: {v:?}");
    });

    // drop(v);

    handle.join().unwrap();
}
```
因为正常所有权在主线程，主线程可能随时会丢弃 `v` 或者对 `v` 进行改动之类（上述示例尽管没有 `drop(v)` 仍然是错误的），导致在新建线程里面使用 `v` 是不安全的。所以需要通过 `move` 关键字将 `v` 传入新建线程，这样主线程将不再拥有 `v`，`drop(v)` 就会提示所有权发生了转移
```rust
use std::thread;

fn main() {
    let v = vec![1, 2, 3];

    let handle = thread::spawn(move || {
        println!("Here's a vector: {v:?}");
    });

    handle.join().unwrap();
}
```

## 传递信息 Channel

类似 Golang 的 chan 或者前面铺垫的 Actor 模型进行交流，Rust 也提供了 Channel，这里是用 `std::sync::mpsc` 的例子。`mpsc` 是 *multiple producer and single consumer* 的简写，顾名思义就是多个生产者单个消费者。
```rust
use std::{sync::mpsc, thread};

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let val = String::from("hi");
        tx.send(val).unwrap();
    });

    let received = rx.recv().unwrap(); 
    println!("Got: {received}");
}
```
想要创建多个生产者只需要使用 `tx.clone()` 即可，并且在 `send` 方法调用的时候变量的所有权将会转移。`recv` 方法返回 `Result`，如果是 `Ok` 表明收到值，如果 `Err` 代表接收者被 drop 并且没有地方可以发送新值。同时有一个 `try_recv` 方法同样返回`Result`，如果此刻有信息将会以 `Ok` 返回，否则 `Err`。

## 共享状态

除了上面那种用 Channel 的方式，还有锁。
```rust
use std::{
    sync::{Arc, Mutex},
    thread,
};

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();

            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());
}
```
因为每个线程不可能同时持有 `Mutex` 的所有权，所以使用 `Arc` 实现引用计数。之所以不用 `Rc`，是因为 `Rc` 为了性能不是线程安全的，而 `Arc` 实现了 `Send` 和 `Sync` trait，是 `Rc` 的线程安全版本。之后并不需要手动调用 `unlock`，而是在 `drop` 函数里面自动实现 `unlock`。并且 `lock` 方法实现了 `Deref` 能够直接解引用拿到目标值。

## Send Sync trait

前面提到的并发功能几乎都是标准库实现的，所以完全可以自己实现或者使用第三方 crate 提供的并发功能。语言层面内建的并发概念有两个：`std::marker` 里面的 `Send` 和 `Sync` 这两个 marker trait。marker trait 意味着并不需要实现具体的方法，其存在的意义是向编译器说明内部能够实现的功能。它们让 Rust 的并发安全检查成为了类型系统的一部分，第三方并发工具只要实现这两个 trait 就能融入同一套体系。但是需要注意的是手动实现这两个 trait 是 unsafe 的。

### Send：所有权可以跨线程转移

`Send` marker trait 表示该类型的值的所有权可以安全地在线程之间转移。几乎所有的 Rust 类型都实现了 `Send`，但也有例外，比如 `Rc<T>`：如果克隆了一个 `Rc<T>` 再把克隆的所有权转移给另一个线程，两个线程可能会同时更新引用计数，产生数据竞争。所以 `Rc<T>` 被设计成只用于单线程场景，避免付出线程安全带来的性能开销。

另外，完全由 `Send` 类型组成的类型也会自动被标记为 `Send`，不需要手动实现。除了裸指针之外，几乎所有原始类型都是 `Send`。

### Sync：可以从多个线程访问

`Sync` marker trait 表示实现该类型的类型可以安全地被多个线程引用。也就是说，类型 `T` 实现 `Sync` 当且仅当 `&T`（对 `T` 的不可变引用）实现 `Send`，也就是这个引用可以被安全地发送到另一个线程。和 `Send` 一样，原始类型都实现了 `Sync`，由 `Sync` 类型组成的类型也自动实现 `Sync`。

`Rc<T>` 出于和 `Send` 同样的原因也没有实现 `Sync`。`RefCell<T>` 以及相关的 `Cell<T>` 系列也没有实现 `Sync`，因为 `RefCell<T>` 在运行时做的借用检查不是线程安全的。而 `Mutex<T>` 实现了 `Sync`，可以用来在多个线程之间共享访问（正如本文共享状态一节的例子）。
