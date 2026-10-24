package com.amanda.urlshortener.link;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ShortLinkRepository extends JpaRepository<ShortLink, Long> {
    Optional<ShortLink> findByCode(String code);

    @Modifying @Transactional
    @Query("update ShortLink s set s.clickCount = s.clickCount + 1 where s.code = :code")
    int incrementClicks(@Param("code") String code);

    @Query("select s from ShortLink s where s.ownerId = :owner and (:before is null or s.id < :before) order by s.id desc")
    Slice<ShortLink> accountLinks(@Param("owner") Long owner, @Param("before") Long before, Pageable pageable);
}
