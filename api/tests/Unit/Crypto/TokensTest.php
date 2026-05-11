<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Crypto\Tokens;

describe('Tokens', function (): void {
    test('generate verify round-trip', function (): void {
        $signer = new Signer();
        $key = random_bytes(32);
        $tokens = new Tokens($key, $signer);
        $t = $tokens->generate('course-abc', time() + 60);
        $claims = $tokens->verify($t, time());
        expect($claims)->not->toBeNull()
            ->and($claims['course_id'])->toBe('course-abc');
    });

    test('tampered token fails', function (): void {
        $signer = new Signer();
        $tokens = new Tokens(random_bytes(32), $signer);
        $t = $tokens->generate('x', time() + 60);
        $raw = $signer->base64UrlDecode($t);
        $broken = substr($raw, 0, -1) . chr(ord($raw[strlen($raw) - 1]) ^ 1);
        $bad = $signer->base64UrlEncode($broken);
        expect($tokens->parseIfMacValid($bad))->toBeNull();
    });

    test('expired token rejected by verify()', function (): void {
        $signer = new Signer();
        $tokens = new Tokens(random_bytes(32), $signer);
        $t = $tokens->generate('c', time() - 10);
        expect($tokens->verify($t, time()))->toBeNull();
    });

    test('constructor rejects wrong HMAC key length', function (): void {
        $signer = new Signer();
        expect(fn (): Tokens => new Tokens(str_repeat('a', 31), $signer))
            ->toThrow(\InvalidArgumentException::class, '32 bytes');
    });
});
