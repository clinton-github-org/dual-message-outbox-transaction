package com.clinton.authorization_server.repository;

import com.clinton.authorization_server.model.Authorization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

/**
 * @author Clinton Fernandes
 */
@Repository
public interface AuthorizationRepository extends JpaRepository<Authorization, Long> {

    @Query("SELECT SUM(a.reservedAmount) FROM Authorization a where a.senderAccountId = :senderAccountId")
    BigDecimal getReservedAmount(Integer senderAccountId);
}
