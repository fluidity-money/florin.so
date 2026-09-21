package liquity

import (
	_ "embed"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	gethTypes "github.com/ethereum/go-ethereum/core/types"

	"github.com/fluidity-money/florin.so/ingest/lib/types/events"
)

var (
	//go:embed abi.json
	mainABIJSON string
	//go:embed bold-token-abi.json
	boldTokenABIJSON string
	//go:embed trove-nft-abi.json
	troveNFTABIJSON string

	mainABI, mainABIErr           = abi.JSON(strings.NewReader(mainABIJSON))
	boldTokenABI, boldTokenABIErr = abi.JSON(strings.NewReader(boldTokenABIJSON))
	troveNFTABI, troveNFTABIErr   = abi.JSON(strings.NewReader(troveNFTABIJSON))

	// ErrABI reports a malformed embedded ABI. It is expected to remain nil.
	ErrABI = errors.Join(mainABIErr, boldTokenABIErr, troveNFTABIErr)
)

var (
	TopicActivePoolAddressAdded           = eventID(mainABI, "ActivePoolAddressAdded")
	TopicActivePoolAddressChanged         = eventID(mainABI, "ActivePoolAddressChanged")
	TopicActivePoolBoldDebtUpdated        = eventID(mainABI, "ActivePoolBoldDebtUpdated")
	TopicActivePoolCollBalanceUpdated     = eventID(mainABI, "ActivePoolCollBalanceUpdated")
	TopicAddManagerUpdated                = eventID(mainABI, "AddManagerUpdated")
	TopicBUpdated                         = eventID(mainABI, "B_Updated")
	TopicBaseRateUpdated                  = eventID(mainABI, "BaseRateUpdated")
	TopicBatchUpdated                     = eventID(mainABI, "BatchUpdated")
	TopicBatchedTroveUpdated              = eventID(mainABI, "BatchedTroveUpdated")
	TopicBoldTokenAddressChanged          = eventID(mainABI, "BoldTokenAddressChanged")
	TopicBorrowerOperationsAddressAdded   = eventID(mainABI, "BorrowerOperationsAddressAdded")
	TopicBorrowerOperationsAddressChanged = eventID(mainABI, "BorrowerOperationsAddressChanged")
	TopicCollBalanceUpdated               = eventID(mainABI, "CollBalanceUpdated")
	TopicCollSent                         = eventID(mainABI, "CollSent")
	TopicCollSurplusPoolAddressChanged    = eventID(mainABI, "CollSurplusPoolAddressChanged")
	TopicCollTokenAddressChanged          = eventID(mainABI, "CollTokenAddressChanged")
	TopicCollateralRegistryAddressChanged = eventID(mainABI, "CollateralRegistryAddressChanged")
	TopicDefaultPoolAddressChanged        = eventID(mainABI, "DefaultPoolAddressChanged")
	TopicDefaultPoolBoldDebtUpdated       = eventID(mainABI, "DefaultPoolBoldDebtUpdated")
	TopicDefaultPoolCollBalanceUpdated    = eventID(mainABI, "DefaultPoolCollBalanceUpdated")
	TopicDepositOperation                 = eventID(mainABI, "DepositOperation")
	TopicDepositUpdated                   = eventID(mainABI, "DepositUpdated")
	TopicGasPoolAddressChanged            = eventID(mainABI, "GasPoolAddressChanged")
	TopicHintHelpersAddressChanged        = eventID(mainABI, "HintHelpersAddressChanged")
	TopicInterestRouterAddressChanged     = eventID(mainABI, "InterestRouterAddressChanged")
	TopicLastGoodPriceUpdated             = eventID(mainABI, "LastGoodPriceUpdated")
	TopicLastFeeOpTimeUpdated             = eventID(mainABI, "LastFeeOpTimeUpdated")
	TopicLiquidation                      = eventID(mainABI, "Liquidation")
	TopicMetadataNFTAddressChanged        = eventID(mainABI, "MetadataNFTAddressChanged")
	TopicMultiTroveGetterAddressChanged   = eventID(mainABI, "MultiTroveGetterAddressChanged")
	TopicOwnershipTransferred             = eventID(mainABI, "OwnershipTransferred")
	TopicPUpdated                         = eventID(mainABI, "P_Updated")
	TopicPriceFeedAddressChanged          = eventID(mainABI, "PriceFeedAddressChanged")
	TopicRedemption                       = eventID(mainABI, "Redemption")
	TopicRedemptionFeePaidToTrove         = eventID(mainABI, "RedemptionFeePaidToTrove")
	TopicRemoveManagerAndReceiverUpdated  = eventID(mainABI, "RemoveManagerAndReceiverUpdated")
	TopicSUpdated                         = eventID(mainABI, "S_Updated")
	TopicScaleUpdated                     = eventID(mainABI, "ScaleUpdated")
	TopicShutDownFromOracleFailure        = eventID(mainABI, "ShutDownFromOracleFailure")
	TopicSortedTrovesAddressChanged       = eventID(mainABI, "SortedTrovesAddressChanged")
	TopicStabilityPoolAddressAdded        = eventID(mainABI, "StabilityPoolAddressAdded")
	TopicStabilityPoolAddressChanged      = eventID(mainABI, "StabilityPoolAddressChanged")
	TopicStabilityPoolBoldBalanceUpdated  = eventID(mainABI, "StabilityPoolBoldBalanceUpdated")
	TopicStabilityPoolCollBalanceUpdated  = eventID(mainABI, "StabilityPoolCollBalanceUpdated")
	TopicTroveManagerAddressAdded         = eventID(mainABI, "TroveManagerAddressAdded")
	TopicTroveManagerAddressChanged       = eventID(mainABI, "TroveManagerAddressChanged")
	TopicTroveNFTAddressChanged           = eventID(mainABI, "TroveNFTAddressChanged")
	TopicTroveOperation                   = eventID(mainABI, "TroveOperation")
	TopicTroveUpdated                     = eventID(mainABI, "TroveUpdated")
	TopicWETHAddressChanged               = eventID(mainABI, "WETHAddressChanged")
	TopicBoldTokenApproval                = eventID(boldTokenABI, "Approval")
	TopicBoldTokenTransfer                = eventID(boldTokenABI, "Transfer")
	TopicTroveNFTApproval                 = eventID(troveNFTABI, "Approval")
	TopicTroveNFTApprovalForAll           = eventID(troveNFTABI, "ApprovalForAll")
	TopicTroveNFTTransfer                 = eventID(troveNFTABI, "Transfer")
)

type ActivePoolAddressAdded struct {
	events.Event
	NewActivePoolAddress events.Address `json:"new_active_pool_address"`
}

func (ActivePoolAddressAdded) TableName() string { return "liquity_events_active_pool_address_added" }

func UnpackActivePoolAddressAdded(topics []common.Hash, data []byte) (*ActivePoolAddressAdded, error) {
	values, err := unpackEvent(mainABI.Events["ActivePoolAddressAdded"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ActivePoolAddressAdded{
		NewActivePoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type ActivePoolAddressChanged struct {
	events.Event
	NewActivePoolAddress events.Address `json:"new_active_pool_address"`
}

func (ActivePoolAddressChanged) TableName() string {
	return "liquity_events_active_pool_address_changed"
}

func UnpackActivePoolAddressChanged(topics []common.Hash, data []byte) (*ActivePoolAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["ActivePoolAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ActivePoolAddressChanged{
		NewActivePoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type ActivePoolBoldDebtUpdated struct {
	events.Event
	RecordedDebtSum events.Number `json:"recorded_debt_sum"`
}

func (ActivePoolBoldDebtUpdated) TableName() string {
	return "liquity_events_active_pool_bold_debt_updated"
}

func UnpackActivePoolBoldDebtUpdated(topics []common.Hash, data []byte) (*ActivePoolBoldDebtUpdated, error) {
	values, err := unpackEvent(mainABI.Events["ActivePoolBoldDebtUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ActivePoolBoldDebtUpdated{
		RecordedDebtSum: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type ActivePoolCollBalanceUpdated struct {
	events.Event
	CollBalance events.Number `json:"coll_balance"`
}

func (ActivePoolCollBalanceUpdated) TableName() string {
	return "liquity_events_active_pool_coll_balance_updated"
}

func UnpackActivePoolCollBalanceUpdated(topics []common.Hash, data []byte) (*ActivePoolCollBalanceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["ActivePoolCollBalanceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ActivePoolCollBalanceUpdated{
		CollBalance: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type AddManagerUpdated struct {
	events.Event
	TroveID       events.Number  `json:"trove_id"`
	NewAddManager events.Address `json:"new_add_manager"`
}

func (AddManagerUpdated) TableName() string { return "liquity_events_add_manager_updated" }

func UnpackAddManagerUpdated(topics []common.Hash, data []byte) (*AddManagerUpdated, error) {
	values, err := unpackEvent(mainABI.Events["AddManagerUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &AddManagerUpdated{
		TroveID:       events.NumberFromBig(values[0].(*big.Int)),
		NewAddManager: events.AddressFromCommon(values[1].(common.Address)),
	}, nil
}

type BUpdated struct {
	events.Event
	B     events.Number `json:"b"`
	Scale events.Number `json:"scale"`
}

func (BUpdated) TableName() string { return "liquity_events_b_updated" }

func UnpackBUpdated(topics []common.Hash, data []byte) (*BUpdated, error) {
	values, err := unpackEvent(mainABI.Events["B_Updated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BUpdated{
		B:     events.NumberFromBig(values[0].(*big.Int)),
		Scale: events.NumberFromBig(values[1].(*big.Int)),
	}, nil
}

type BaseRateUpdated struct {
	events.Event
	BaseRate events.Number `json:"base_rate"`
}

func (BaseRateUpdated) TableName() string { return "liquity_events_base_rate_updated" }

func UnpackBaseRateUpdated(topics []common.Hash, data []byte) (*BaseRateUpdated, error) {
	values, err := unpackEvent(mainABI.Events["BaseRateUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BaseRateUpdated{
		BaseRate: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type BatchUpdated struct {
	events.Event
	InterestBatchManager       events.Address `json:"interest_batch_manager"`
	Operation                  uint8          `json:"operation"`
	Debt                       events.Number  `json:"debt"`
	Coll                       events.Number  `json:"coll"`
	AnnualInterestRate         events.Number  `json:"annual_interest_rate"`
	AnnualManagementFee        events.Number  `json:"annual_management_fee"`
	TotalDebtShares            events.Number  `json:"total_debt_shares"`
	DebtIncreaseFromUpfrontFee events.Number  `json:"debt_increase_from_upfront_fee"`
}

func (BatchUpdated) TableName() string { return "liquity_events_batch_updated" }

func UnpackBatchUpdated(topics []common.Hash, data []byte) (*BatchUpdated, error) {
	values, err := unpackEvent(mainABI.Events["BatchUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BatchUpdated{
		InterestBatchManager:       events.AddressFromCommon(values[0].(common.Address)),
		Operation:                  values[1].(uint8),
		Debt:                       events.NumberFromBig(values[2].(*big.Int)),
		Coll:                       events.NumberFromBig(values[3].(*big.Int)),
		AnnualInterestRate:         events.NumberFromBig(values[4].(*big.Int)),
		AnnualManagementFee:        events.NumberFromBig(values[5].(*big.Int)),
		TotalDebtShares:            events.NumberFromBig(values[6].(*big.Int)),
		DebtIncreaseFromUpfrontFee: events.NumberFromBig(values[7].(*big.Int)),
	}, nil
}

type BatchedTroveUpdated struct {
	events.Event
	TroveID                   events.Number  `json:"trove_id"`
	InterestBatchManager      events.Address `json:"interest_batch_manager"`
	BatchDebtShares           events.Number  `json:"batch_debt_shares"`
	Coll                      events.Number  `json:"coll"`
	Stake                     events.Number  `json:"stake"`
	SnapshotOfTotalCollRedist events.Number  `json:"snapshot_of_total_coll_redist"`
	SnapshotOfTotalDebtRedist events.Number  `json:"snapshot_of_total_debt_redist"`
}

func (BatchedTroveUpdated) TableName() string { return "liquity_events_batched_trove_updated" }

func UnpackBatchedTroveUpdated(topics []common.Hash, data []byte) (*BatchedTroveUpdated, error) {
	values, err := unpackEvent(mainABI.Events["BatchedTroveUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BatchedTroveUpdated{
		TroveID:                   events.NumberFromBig(values[0].(*big.Int)),
		InterestBatchManager:      events.AddressFromCommon(values[1].(common.Address)),
		BatchDebtShares:           events.NumberFromBig(values[2].(*big.Int)),
		Coll:                      events.NumberFromBig(values[3].(*big.Int)),
		Stake:                     events.NumberFromBig(values[4].(*big.Int)),
		SnapshotOfTotalCollRedist: events.NumberFromBig(values[5].(*big.Int)),
		SnapshotOfTotalDebtRedist: events.NumberFromBig(values[6].(*big.Int)),
	}, nil
}

type BoldTokenAddressChanged struct {
	events.Event
	NewBoldTokenAddress events.Address `json:"new_bold_token_address"`
}

func (BoldTokenAddressChanged) TableName() string { return "liquity_events_bold_token_address_changed" }

func UnpackBoldTokenAddressChanged(topics []common.Hash, data []byte) (*BoldTokenAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["BoldTokenAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BoldTokenAddressChanged{
		NewBoldTokenAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type BorrowerOperationsAddressAdded struct {
	events.Event
	NewBorrowerOperationsAddress events.Address `json:"new_borrower_operations_address"`
}

func (BorrowerOperationsAddressAdded) TableName() string {
	return "liquity_events_borrower_operations_address_added"
}

func UnpackBorrowerOperationsAddressAdded(topics []common.Hash, data []byte) (*BorrowerOperationsAddressAdded, error) {
	values, err := unpackEvent(mainABI.Events["BorrowerOperationsAddressAdded"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BorrowerOperationsAddressAdded{
		NewBorrowerOperationsAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type BorrowerOperationsAddressChanged struct {
	events.Event
	NewBorrowerOperationsAddress events.Address `json:"new_borrower_operations_address"`
}

func (BorrowerOperationsAddressChanged) TableName() string {
	return "liquity_events_borrower_operations_address_changed"
}

func UnpackBorrowerOperationsAddressChanged(topics []common.Hash, data []byte) (*BorrowerOperationsAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["BorrowerOperationsAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BorrowerOperationsAddressChanged{
		NewBorrowerOperationsAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type CollBalanceUpdated struct {
	events.Event
	Account    events.Address `json:"account"`
	NewBalance events.Number  `json:"new_balance"`
}

func (CollBalanceUpdated) TableName() string { return "liquity_events_coll_balance_updated" }

func UnpackCollBalanceUpdated(topics []common.Hash, data []byte) (*CollBalanceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["CollBalanceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &CollBalanceUpdated{
		Account:    events.AddressFromCommon(values[0].(common.Address)),
		NewBalance: events.NumberFromBig(values[1].(*big.Int)),
	}, nil
}

type CollSent struct {
	events.Event
	ToAddress events.Address `json:"to_address"`
	Amount    events.Number  `json:"amount"`
}

func (CollSent) TableName() string { return "liquity_events_coll_sent" }

func UnpackCollSent(topics []common.Hash, data []byte) (*CollSent, error) {
	values, err := unpackEvent(mainABI.Events["CollSent"], topics, data)
	if err != nil {
		return nil, err
	}
	return &CollSent{
		ToAddress: events.AddressFromCommon(values[0].(common.Address)),
		Amount:    events.NumberFromBig(values[1].(*big.Int)),
	}, nil
}

type CollSurplusPoolAddressChanged struct {
	events.Event
	CollSurplusPoolAddress events.Address `json:"coll_surplus_pool_address"`
}

func (CollSurplusPoolAddressChanged) TableName() string {
	return "liquity_events_coll_surplus_pool_address_changed"
}

func UnpackCollSurplusPoolAddressChanged(topics []common.Hash, data []byte) (*CollSurplusPoolAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["CollSurplusPoolAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &CollSurplusPoolAddressChanged{
		CollSurplusPoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type CollTokenAddressChanged struct {
	events.Event
	NewCollTokenAddress events.Address `json:"new_coll_token_address"`
}

func (CollTokenAddressChanged) TableName() string { return "liquity_events_coll_token_address_changed" }

func UnpackCollTokenAddressChanged(topics []common.Hash, data []byte) (*CollTokenAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["CollTokenAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &CollTokenAddressChanged{
		NewCollTokenAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type CollateralRegistryAddressChanged struct {
	events.Event
	CollateralRegistryAddress events.Address `json:"collateral_registry_address"`
}

func (CollateralRegistryAddressChanged) TableName() string {
	return "liquity_events_collateral_registry_address_changed"
}

func UnpackCollateralRegistryAddressChanged(topics []common.Hash, data []byte) (*CollateralRegistryAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["CollateralRegistryAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &CollateralRegistryAddressChanged{
		CollateralRegistryAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type DefaultPoolAddressChanged struct {
	events.Event
	NewDefaultPoolAddress events.Address `json:"new_default_pool_address"`
}

func (DefaultPoolAddressChanged) TableName() string {
	return "liquity_events_default_pool_address_changed"
}

func UnpackDefaultPoolAddressChanged(topics []common.Hash, data []byte) (*DefaultPoolAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["DefaultPoolAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &DefaultPoolAddressChanged{
		NewDefaultPoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type DefaultPoolBoldDebtUpdated struct {
	events.Event
	BoldDebt events.Number `json:"bold_debt"`
}

func (DefaultPoolBoldDebtUpdated) TableName() string {
	return "liquity_events_default_pool_bold_debt_updated"
}

func UnpackDefaultPoolBoldDebtUpdated(topics []common.Hash, data []byte) (*DefaultPoolBoldDebtUpdated, error) {
	values, err := unpackEvent(mainABI.Events["DefaultPoolBoldDebtUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &DefaultPoolBoldDebtUpdated{
		BoldDebt: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type DefaultPoolCollBalanceUpdated struct {
	events.Event
	CollBalance events.Number `json:"coll_balance"`
}

func (DefaultPoolCollBalanceUpdated) TableName() string {
	return "liquity_events_default_pool_coll_balance_updated"
}

func UnpackDefaultPoolCollBalanceUpdated(topics []common.Hash, data []byte) (*DefaultPoolCollBalanceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["DefaultPoolCollBalanceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &DefaultPoolCollBalanceUpdated{
		CollBalance: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type DepositOperation struct {
	events.Event
	Depositor                     events.Address `json:"depositor"`
	Operation                     uint8          `json:"operation"`
	DepositLossSinceLastOperation events.Number  `json:"deposit_loss_since_last_operation"`
	TopUpOrWithdrawal             events.Number  `json:"top_up_or_withdrawal"`
	YieldGainSinceLastOperation   events.Number  `json:"yield_gain_since_last_operation"`
	YieldGainClaimed              events.Number  `json:"yield_gain_claimed"`
	ETHGainSinceLastOperation     events.Number  `json:"eth_gain_since_last_operation"`
	ETHGainClaimed                events.Number  `json:"eth_gain_claimed"`
}

func (DepositOperation) TableName() string { return "liquity_events_deposit_operation" }

func UnpackDepositOperation(topics []common.Hash, data []byte) (*DepositOperation, error) {
	values, err := unpackEvent(mainABI.Events["DepositOperation"], topics, data)
	if err != nil {
		return nil, err
	}
	return &DepositOperation{
		Depositor:                     events.AddressFromCommon(values[0].(common.Address)),
		Operation:                     values[1].(uint8),
		DepositLossSinceLastOperation: events.NumberFromBig(values[2].(*big.Int)),
		TopUpOrWithdrawal:             events.NumberFromBig(values[3].(*big.Int)),
		YieldGainSinceLastOperation:   events.NumberFromBig(values[4].(*big.Int)),
		YieldGainClaimed:              events.NumberFromBig(values[5].(*big.Int)),
		ETHGainSinceLastOperation:     events.NumberFromBig(values[6].(*big.Int)),
		ETHGainClaimed:                events.NumberFromBig(values[7].(*big.Int)),
	}, nil
}

type DepositUpdated struct {
	events.Event
	Depositor     events.Address `json:"depositor"`
	NewDeposit    events.Number  `json:"new_deposit"`
	StashedColl   events.Number  `json:"stashed_coll"`
	SnapshotP     events.Number  `json:"snapshot_p"`
	SnapshotS     events.Number  `json:"snapshot_s"`
	SnapshotB     events.Number  `json:"snapshot_b"`
	SnapshotScale events.Number  `json:"snapshot_scale"`
}

func (DepositUpdated) TableName() string { return "liquity_events_deposit_updated" }

func UnpackDepositUpdated(topics []common.Hash, data []byte) (*DepositUpdated, error) {
	values, err := unpackEvent(mainABI.Events["DepositUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &DepositUpdated{
		Depositor:     events.AddressFromCommon(values[0].(common.Address)),
		NewDeposit:    events.NumberFromBig(values[1].(*big.Int)),
		StashedColl:   events.NumberFromBig(values[2].(*big.Int)),
		SnapshotP:     events.NumberFromBig(values[3].(*big.Int)),
		SnapshotS:     events.NumberFromBig(values[4].(*big.Int)),
		SnapshotB:     events.NumberFromBig(values[5].(*big.Int)),
		SnapshotScale: events.NumberFromBig(values[6].(*big.Int)),
	}, nil
}

type GasPoolAddressChanged struct {
	events.Event
	GasPoolAddress events.Address `json:"gas_pool_address"`
}

func (GasPoolAddressChanged) TableName() string { return "liquity_events_gas_pool_address_changed" }

func UnpackGasPoolAddressChanged(topics []common.Hash, data []byte) (*GasPoolAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["GasPoolAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &GasPoolAddressChanged{
		GasPoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type HintHelpersAddressChanged struct {
	events.Event
	HintHelpersAddress events.Address `json:"hint_helpers_address"`
}

func (HintHelpersAddressChanged) TableName() string {
	return "liquity_events_hint_helpers_address_changed"
}

func UnpackHintHelpersAddressChanged(topics []common.Hash, data []byte) (*HintHelpersAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["HintHelpersAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &HintHelpersAddressChanged{
		HintHelpersAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type InterestRouterAddressChanged struct {
	events.Event
	InterestRouterAddress events.Address `json:"interest_router_address"`
}

func (InterestRouterAddressChanged) TableName() string {
	return "liquity_events_interest_router_address_changed"
}

func UnpackInterestRouterAddressChanged(topics []common.Hash, data []byte) (*InterestRouterAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["InterestRouterAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &InterestRouterAddressChanged{
		InterestRouterAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type LastGoodPriceUpdated struct {
	events.Event
	LastGoodPrice events.Number `json:"last_good_price"`
}

func (LastGoodPriceUpdated) TableName() string { return "liquity_events_last_good_price_updated" }

func UnpackLastGoodPriceUpdated(topics []common.Hash, data []byte) (*LastGoodPriceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["LastGoodPriceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &LastGoodPriceUpdated{
		LastGoodPrice: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type LastFeeOpTimeUpdated struct {
	events.Event
	LastFeeOpTime events.Number `json:"last_fee_op_time"`
}

func (LastFeeOpTimeUpdated) TableName() string { return "liquity_events_last_fee_op_time_updated" }

func UnpackLastFeeOpTimeUpdated(topics []common.Hash, data []byte) (*LastFeeOpTimeUpdated, error) {
	values, err := unpackEvent(mainABI.Events["LastFeeOpTimeUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &LastFeeOpTimeUpdated{
		LastFeeOpTime: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type Liquidation struct {
	events.Event
	DebtOffsetBySp      events.Number `json:"debt_offset_by_sp"`
	DebtRedistributed   events.Number `json:"debt_redistributed"`
	BoldGasCompensation events.Number `json:"bold_gas_compensation"`
	CollGasCompensation events.Number `json:"coll_gas_compensation"`
	CollSentToSp        events.Number `json:"coll_sent_to_sp"`
	CollRedistributed   events.Number `json:"coll_redistributed"`
	CollSurplus         events.Number `json:"coll_surplus"`
	LETH                events.Number `json:"l_eth"`
	LBoldDebt           events.Number `json:"l_bold_debt"`
	Price               events.Number `json:"price"`
}

func (Liquidation) TableName() string { return "liquity_events_liquidation" }

func UnpackLiquidation(topics []common.Hash, data []byte) (*Liquidation, error) {
	values, err := unpackEvent(mainABI.Events["Liquidation"], topics, data)
	if err != nil {
		return nil, err
	}
	return &Liquidation{
		DebtOffsetBySp:      events.NumberFromBig(values[0].(*big.Int)),
		DebtRedistributed:   events.NumberFromBig(values[1].(*big.Int)),
		BoldGasCompensation: events.NumberFromBig(values[2].(*big.Int)),
		CollGasCompensation: events.NumberFromBig(values[3].(*big.Int)),
		CollSentToSp:        events.NumberFromBig(values[4].(*big.Int)),
		CollRedistributed:   events.NumberFromBig(values[5].(*big.Int)),
		CollSurplus:         events.NumberFromBig(values[6].(*big.Int)),
		LETH:                events.NumberFromBig(values[7].(*big.Int)),
		LBoldDebt:           events.NumberFromBig(values[8].(*big.Int)),
		Price:               events.NumberFromBig(values[9].(*big.Int)),
	}, nil
}

type MetadataNFTAddressChanged struct {
	events.Event
	MetadataNFTAddress events.Address `json:"metadata_nft_address"`
}

func (MetadataNFTAddressChanged) TableName() string {
	return "liquity_events_metadata_nft_address_changed"
}

func UnpackMetadataNFTAddressChanged(topics []common.Hash, data []byte) (*MetadataNFTAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["MetadataNFTAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &MetadataNFTAddressChanged{
		MetadataNFTAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type MultiTroveGetterAddressChanged struct {
	events.Event
	MultiTroveGetterAddress events.Address `json:"multi_trove_getter_address"`
}

func (MultiTroveGetterAddressChanged) TableName() string {
	return "liquity_events_multi_trove_getter_address_changed"
}

func UnpackMultiTroveGetterAddressChanged(topics []common.Hash, data []byte) (*MultiTroveGetterAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["MultiTroveGetterAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &MultiTroveGetterAddressChanged{
		MultiTroveGetterAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type OwnershipTransferred struct {
	events.Event
	PreviousOwner events.Address `json:"previous_owner"`
	NewOwner      events.Address `json:"new_owner"`
}

func (OwnershipTransferred) TableName() string { return "liquity_events_ownership_transferred" }

func UnpackOwnershipTransferred(topics []common.Hash, data []byte) (*OwnershipTransferred, error) {
	values, err := unpackEvent(mainABI.Events["OwnershipTransferred"], topics, data)
	if err != nil {
		return nil, err
	}
	return &OwnershipTransferred{
		PreviousOwner: events.AddressFromCommon(values[0].(common.Address)),
		NewOwner:      events.AddressFromCommon(values[1].(common.Address)),
	}, nil
}

type PUpdated struct {
	events.Event
	P events.Number `json:"p"`
}

func (PUpdated) TableName() string { return "liquity_events_p_updated" }

func UnpackPUpdated(topics []common.Hash, data []byte) (*PUpdated, error) {
	values, err := unpackEvent(mainABI.Events["P_Updated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &PUpdated{
		P: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type PriceFeedAddressChanged struct {
	events.Event
	NewPriceFeedAddress events.Address `json:"new_price_feed_address"`
}

func (PriceFeedAddressChanged) TableName() string { return "liquity_events_price_feed_address_changed" }

func UnpackPriceFeedAddressChanged(topics []common.Hash, data []byte) (*PriceFeedAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["PriceFeedAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &PriceFeedAddressChanged{
		NewPriceFeedAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type Redemption struct {
	events.Event
	AttemptedBoldAmount events.Number `json:"attempted_bold_amount"`
	ActualBoldAmount    events.Number `json:"actual_bold_amount"`
	ETHSent             events.Number `json:"eth_sent"`
	ETHFee              events.Number `json:"eth_fee"`
	Price               events.Number `json:"price"`
	RedemptionPrice     events.Number `json:"redemption_price"`
}

func (Redemption) TableName() string { return "liquity_events_redemption" }

func UnpackRedemption(topics []common.Hash, data []byte) (*Redemption, error) {
	values, err := unpackEvent(mainABI.Events["Redemption"], topics, data)
	if err != nil {
		return nil, err
	}
	return &Redemption{
		AttemptedBoldAmount: events.NumberFromBig(values[0].(*big.Int)),
		ActualBoldAmount:    events.NumberFromBig(values[1].(*big.Int)),
		ETHSent:             events.NumberFromBig(values[2].(*big.Int)),
		ETHFee:              events.NumberFromBig(values[3].(*big.Int)),
		Price:               events.NumberFromBig(values[4].(*big.Int)),
		RedemptionPrice:     events.NumberFromBig(values[5].(*big.Int)),
	}, nil
}

type RedemptionFeePaidToTrove struct {
	events.Event
	TroveID events.Number `json:"trove_id"`
	ETHFee  events.Number `json:"eth_fee"`
}

func (RedemptionFeePaidToTrove) TableName() string {
	return "liquity_events_redemption_fee_paid_to_trove"
}

func UnpackRedemptionFeePaidToTrove(topics []common.Hash, data []byte) (*RedemptionFeePaidToTrove, error) {
	values, err := unpackEvent(mainABI.Events["RedemptionFeePaidToTrove"], topics, data)
	if err != nil {
		return nil, err
	}
	return &RedemptionFeePaidToTrove{
		TroveID: events.NumberFromBig(values[0].(*big.Int)),
		ETHFee:  events.NumberFromBig(values[1].(*big.Int)),
	}, nil
}

type RemoveManagerAndReceiverUpdated struct {
	events.Event
	TroveID          events.Number  `json:"trove_id"`
	NewRemoveManager events.Address `json:"new_remove_manager"`
	NewReceiver      events.Address `json:"new_receiver"`
}

func (RemoveManagerAndReceiverUpdated) TableName() string {
	return "liquity_events_remove_manager_and_receiver_updated"
}

func UnpackRemoveManagerAndReceiverUpdated(topics []common.Hash, data []byte) (*RemoveManagerAndReceiverUpdated, error) {
	values, err := unpackEvent(mainABI.Events["RemoveManagerAndReceiverUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &RemoveManagerAndReceiverUpdated{
		TroveID:          events.NumberFromBig(values[0].(*big.Int)),
		NewRemoveManager: events.AddressFromCommon(values[1].(common.Address)),
		NewReceiver:      events.AddressFromCommon(values[2].(common.Address)),
	}, nil
}

type SUpdated struct {
	events.Event
	S     events.Number `json:"s"`
	Scale events.Number `json:"scale"`
}

func (SUpdated) TableName() string { return "liquity_events_s_updated" }

func UnpackSUpdated(topics []common.Hash, data []byte) (*SUpdated, error) {
	values, err := unpackEvent(mainABI.Events["S_Updated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &SUpdated{
		S:     events.NumberFromBig(values[0].(*big.Int)),
		Scale: events.NumberFromBig(values[1].(*big.Int)),
	}, nil
}

type ScaleUpdated struct {
	events.Event
	CurrentScale events.Number `json:"current_scale"`
}

func (ScaleUpdated) TableName() string { return "liquity_events_scale_updated" }

func UnpackScaleUpdated(topics []common.Hash, data []byte) (*ScaleUpdated, error) {
	values, err := unpackEvent(mainABI.Events["ScaleUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ScaleUpdated{
		CurrentScale: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type ShutDownFromOracleFailure struct {
	events.Event
	FailedOracleAddr events.Address `json:"failed_oracle_addr"`
}

func (ShutDownFromOracleFailure) TableName() string {
	return "liquity_events_shut_down_from_oracle_failure"
}

func UnpackShutDownFromOracleFailure(topics []common.Hash, data []byte) (*ShutDownFromOracleFailure, error) {
	values, err := unpackEvent(mainABI.Events["ShutDownFromOracleFailure"], topics, data)
	if err != nil {
		return nil, err
	}
	return &ShutDownFromOracleFailure{
		FailedOracleAddr: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type SortedTrovesAddressChanged struct {
	events.Event
	SortedTrovesAddress events.Address `json:"sorted_troves_address"`
}

func (SortedTrovesAddressChanged) TableName() string {
	return "liquity_events_sorted_troves_address_changed"
}

func UnpackSortedTrovesAddressChanged(topics []common.Hash, data []byte) (*SortedTrovesAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["SortedTrovesAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &SortedTrovesAddressChanged{
		SortedTrovesAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type StabilityPoolAddressAdded struct {
	events.Event
	NewStabilityPoolAddress events.Address `json:"new_stability_pool_address"`
}

func (StabilityPoolAddressAdded) TableName() string {
	return "liquity_events_stability_pool_address_added"
}

func UnpackStabilityPoolAddressAdded(topics []common.Hash, data []byte) (*StabilityPoolAddressAdded, error) {
	values, err := unpackEvent(mainABI.Events["StabilityPoolAddressAdded"], topics, data)
	if err != nil {
		return nil, err
	}
	return &StabilityPoolAddressAdded{
		NewStabilityPoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type StabilityPoolAddressChanged struct {
	events.Event
	StabilityPoolAddress events.Address `json:"stability_pool_address"`
}

func (StabilityPoolAddressChanged) TableName() string {
	return "liquity_events_stability_pool_address_changed"
}

func UnpackStabilityPoolAddressChanged(topics []common.Hash, data []byte) (*StabilityPoolAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["StabilityPoolAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &StabilityPoolAddressChanged{
		StabilityPoolAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type StabilityPoolBoldBalanceUpdated struct {
	events.Event
	NewBalance events.Number `json:"new_balance"`
}

func (StabilityPoolBoldBalanceUpdated) TableName() string {
	return "liquity_events_stability_pool_bold_balance_updated"
}

func UnpackStabilityPoolBoldBalanceUpdated(topics []common.Hash, data []byte) (*StabilityPoolBoldBalanceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["StabilityPoolBoldBalanceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &StabilityPoolBoldBalanceUpdated{
		NewBalance: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type StabilityPoolCollBalanceUpdated struct {
	events.Event
	NewBalance events.Number `json:"new_balance"`
}

func (StabilityPoolCollBalanceUpdated) TableName() string {
	return "liquity_events_stability_pool_coll_balance_updated"
}

func UnpackStabilityPoolCollBalanceUpdated(topics []common.Hash, data []byte) (*StabilityPoolCollBalanceUpdated, error) {
	values, err := unpackEvent(mainABI.Events["StabilityPoolCollBalanceUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &StabilityPoolCollBalanceUpdated{
		NewBalance: events.NumberFromBig(values[0].(*big.Int)),
	}, nil
}

type TroveManagerAddressAdded struct {
	events.Event
	NewTroveManagerAddress events.Address `json:"new_trove_manager_address"`
}

func (TroveManagerAddressAdded) TableName() string {
	return "liquity_events_trove_manager_address_added"
}

func UnpackTroveManagerAddressAdded(topics []common.Hash, data []byte) (*TroveManagerAddressAdded, error) {
	values, err := unpackEvent(mainABI.Events["TroveManagerAddressAdded"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveManagerAddressAdded{
		NewTroveManagerAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type TroveManagerAddressChanged struct {
	events.Event
	NewTroveManagerAddress events.Address `json:"new_trove_manager_address"`
}

func (TroveManagerAddressChanged) TableName() string {
	return "liquity_events_trove_manager_address_changed"
}

func UnpackTroveManagerAddressChanged(topics []common.Hash, data []byte) (*TroveManagerAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["TroveManagerAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveManagerAddressChanged{
		NewTroveManagerAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type TroveNFTAddressChanged struct {
	events.Event
	NewTroveNFTAddress events.Address `json:"new_trove_nft_address"`
}

func (TroveNFTAddressChanged) TableName() string { return "liquity_events_trove_nft_address_changed" }

func UnpackTroveNFTAddressChanged(topics []common.Hash, data []byte) (*TroveNFTAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["TroveNFTAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveNFTAddressChanged{
		NewTroveNFTAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type TroveOperation struct {
	events.Event
	TroveID                    events.Number `json:"trove_id"`
	Operation                  uint8         `json:"operation"`
	AnnualInterestRate         events.Number `json:"annual_interest_rate"`
	DebtIncreaseFromRedist     events.Number `json:"debt_increase_from_redist"`
	DebtIncreaseFromUpfrontFee events.Number `json:"debt_increase_from_upfront_fee"`
	DebtChangeFromOperation    events.Number `json:"debt_change_from_operation"`
	CollIncreaseFromRedist     events.Number `json:"coll_increase_from_redist"`
	CollChangeFromOperation    events.Number `json:"coll_change_from_operation"`
}

func (TroveOperation) TableName() string { return "liquity_events_trove_operation" }

func UnpackTroveOperation(topics []common.Hash, data []byte) (*TroveOperation, error) {
	values, err := unpackEvent(mainABI.Events["TroveOperation"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveOperation{
		TroveID:                    events.NumberFromBig(values[0].(*big.Int)),
		Operation:                  values[1].(uint8),
		AnnualInterestRate:         events.NumberFromBig(values[2].(*big.Int)),
		DebtIncreaseFromRedist:     events.NumberFromBig(values[3].(*big.Int)),
		DebtIncreaseFromUpfrontFee: events.NumberFromBig(values[4].(*big.Int)),
		DebtChangeFromOperation:    events.NumberFromBig(values[5].(*big.Int)),
		CollIncreaseFromRedist:     events.NumberFromBig(values[6].(*big.Int)),
		CollChangeFromOperation:    events.NumberFromBig(values[7].(*big.Int)),
	}, nil
}

type TroveUpdated struct {
	events.Event
	TroveID                   events.Number `json:"trove_id"`
	Debt                      events.Number `json:"debt"`
	Coll                      events.Number `json:"coll"`
	Stake                     events.Number `json:"stake"`
	AnnualInterestRate        events.Number `json:"annual_interest_rate"`
	SnapshotOfTotalCollRedist events.Number `json:"snapshot_of_total_coll_redist"`
	SnapshotOfTotalDebtRedist events.Number `json:"snapshot_of_total_debt_redist"`
}

func (TroveUpdated) TableName() string { return "liquity_events_trove_updated" }

func UnpackTroveUpdated(topics []common.Hash, data []byte) (*TroveUpdated, error) {
	values, err := unpackEvent(mainABI.Events["TroveUpdated"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveUpdated{
		TroveID:                   events.NumberFromBig(values[0].(*big.Int)),
		Debt:                      events.NumberFromBig(values[1].(*big.Int)),
		Coll:                      events.NumberFromBig(values[2].(*big.Int)),
		Stake:                     events.NumberFromBig(values[3].(*big.Int)),
		AnnualInterestRate:        events.NumberFromBig(values[4].(*big.Int)),
		SnapshotOfTotalCollRedist: events.NumberFromBig(values[5].(*big.Int)),
		SnapshotOfTotalDebtRedist: events.NumberFromBig(values[6].(*big.Int)),
	}, nil
}

type WETHAddressChanged struct {
	events.Event
	WETHAddress events.Address `json:"weth_address"`
}

func (WETHAddressChanged) TableName() string { return "liquity_events_weth_address_changed" }

func UnpackWETHAddressChanged(topics []common.Hash, data []byte) (*WETHAddressChanged, error) {
	values, err := unpackEvent(mainABI.Events["WETHAddressChanged"], topics, data)
	if err != nil {
		return nil, err
	}
	return &WETHAddressChanged{
		WETHAddress: events.AddressFromCommon(values[0].(common.Address)),
	}, nil
}

type BoldTokenApproval struct {
	events.Event
	Owner   events.Address `json:"owner"`
	Spender events.Address `json:"spender"`
	Value   events.Number  `json:"value"`
}

func (BoldTokenApproval) TableName() string { return "liquity_events_bold_token_approval" }

func UnpackBoldTokenApproval(topics []common.Hash, data []byte) (*BoldTokenApproval, error) {
	values, err := unpackEvent(boldTokenABI.Events["Approval"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BoldTokenApproval{
		Owner:   events.AddressFromCommon(values[0].(common.Address)),
		Spender: events.AddressFromCommon(values[1].(common.Address)),
		Value:   events.NumberFromBig(values[2].(*big.Int)),
	}, nil
}

type BoldTokenTransfer struct {
	events.Event
	FromAddress events.Address `json:"from_address"`
	ToAddress   events.Address `json:"to_address"`
	Value       events.Number  `json:"value"`
}

func (BoldTokenTransfer) TableName() string { return "liquity_events_bold_token_transfer" }

func UnpackBoldTokenTransfer(topics []common.Hash, data []byte) (*BoldTokenTransfer, error) {
	values, err := unpackEvent(boldTokenABI.Events["Transfer"], topics, data)
	if err != nil {
		return nil, err
	}
	return &BoldTokenTransfer{
		FromAddress: events.AddressFromCommon(values[0].(common.Address)),
		ToAddress:   events.AddressFromCommon(values[1].(common.Address)),
		Value:       events.NumberFromBig(values[2].(*big.Int)),
	}, nil
}

type TroveNFTApproval struct {
	events.Event
	Owner    events.Address `json:"owner"`
	Approved events.Address `json:"approved"`
	TokenID  events.Number  `json:"token_id"`
}

func (TroveNFTApproval) TableName() string { return "liquity_events_trove_nft_approval" }

func UnpackTroveNFTApproval(topics []common.Hash, data []byte) (*TroveNFTApproval, error) {
	values, err := unpackEvent(troveNFTABI.Events["Approval"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveNFTApproval{
		Owner:    events.AddressFromCommon(values[0].(common.Address)),
		Approved: events.AddressFromCommon(values[1].(common.Address)),
		TokenID:  events.NumberFromBig(values[2].(*big.Int)),
	}, nil
}

type TroveNFTApprovalForAll struct {
	events.Event
	Owner    events.Address `json:"owner"`
	Operator events.Address `json:"operator"`
	Approved bool           `json:"approved"`
}

func (TroveNFTApprovalForAll) TableName() string { return "liquity_events_trove_nft_approval_for_all" }

func UnpackTroveNFTApprovalForAll(topics []common.Hash, data []byte) (*TroveNFTApprovalForAll, error) {
	values, err := unpackEvent(troveNFTABI.Events["ApprovalForAll"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveNFTApprovalForAll{
		Owner:    events.AddressFromCommon(values[0].(common.Address)),
		Operator: events.AddressFromCommon(values[1].(common.Address)),
		Approved: values[2].(bool),
	}, nil
}

type TroveNFTTransfer struct {
	events.Event
	FromAddress events.Address `json:"from_address"`
	ToAddress   events.Address `json:"to_address"`
	TokenID     events.Number  `json:"token_id"`
}

func (TroveNFTTransfer) TableName() string { return "liquity_events_trove_nft_transfer" }

func UnpackTroveNFTTransfer(topics []common.Hash, data []byte) (*TroveNFTTransfer, error) {
	values, err := unpackEvent(troveNFTABI.Events["Transfer"], topics, data)
	if err != nil {
		return nil, err
	}
	return &TroveNFTTransfer{
		FromAddress: events.AddressFromCommon(values[0].(common.Address)),
		ToAddress:   events.AddressFromCommon(values[1].(common.Address)),
		TokenID:     events.NumberFromBig(values[2].(*big.Int)),
	}, nil
}

func eventID(contractABI abi.ABI, name string) common.Hash {
	if ErrABI != nil {
		return common.Hash{}
	}
	return contractABI.Events[name].ID
}

func unpackEvent(event abi.Event, topics []common.Hash, data []byte) ([]any, error) {
	indexedCount := 0
	for _, input := range event.Inputs {
		if input.Indexed {
			indexedCount++
		}
	}
	if len(topics) != indexedCount+1 {
		return nil, fmt.Errorf("%s: got %d topics, want %d", event.Name, len(topics), indexedCount+1)
	}
	if topics[0] != event.ID {
		return nil, fmt.Errorf("%s: unexpected topic %s", event.Name, topics[0])
	}
	nonIndexed, err := event.Inputs.NonIndexed().Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("unpack %s data: %w", event.Name, err)
	}
	values := make([]any, 0, len(event.Inputs))
	topicIndex, dataIndex := 1, 0
	for _, input := range event.Inputs {
		if !input.Indexed {
			values = append(values, nonIndexed[dataIndex])
			dataIndex++
			continue
		}
		switch input.Type.T {
		case abi.AddressTy:
			values = append(values, common.BytesToAddress(topics[topicIndex].Bytes()))
		case abi.IntTy, abi.UintTy:
			values = append(values, new(big.Int).SetBytes(topics[topicIndex].Bytes()))
		default:
			return nil, fmt.Errorf("%s: unsupported indexed type %s", event.Name, input.Type.String())
		}
		topicIndex++
	}
	return values, nil
}

// Topics returns the unique event signature topics used by the ingestion filter.
func Topics() []common.Hash {
	seen := make(map[common.Hash]struct{})
	out := make([]common.Hash, 0, len(decoders)+3)
	for topic := range decoders {
		seen[topic] = struct{}{}
		out = append(out, topic)
	}
	for _, topic := range []common.Hash{TopicBoldTokenApproval, TopicBoldTokenTransfer, TopicTroveNFTApprovalForAll} {
		if _, ok := seen[topic]; !ok {
			out = append(out, topic)
		}
	}
	return out
}

type decoder func([]common.Hash, []byte) (any, error)

var decoders = map[common.Hash]decoder{
	TopicActivePoolAddressAdded:           func(t []common.Hash, d []byte) (any, error) { return UnpackActivePoolAddressAdded(t, d) },
	TopicActivePoolAddressChanged:         func(t []common.Hash, d []byte) (any, error) { return UnpackActivePoolAddressChanged(t, d) },
	TopicActivePoolBoldDebtUpdated:        func(t []common.Hash, d []byte) (any, error) { return UnpackActivePoolBoldDebtUpdated(t, d) },
	TopicActivePoolCollBalanceUpdated:     func(t []common.Hash, d []byte) (any, error) { return UnpackActivePoolCollBalanceUpdated(t, d) },
	TopicAddManagerUpdated:                func(t []common.Hash, d []byte) (any, error) { return UnpackAddManagerUpdated(t, d) },
	TopicBUpdated:                         func(t []common.Hash, d []byte) (any, error) { return UnpackBUpdated(t, d) },
	TopicBaseRateUpdated:                  func(t []common.Hash, d []byte) (any, error) { return UnpackBaseRateUpdated(t, d) },
	TopicBatchUpdated:                     func(t []common.Hash, d []byte) (any, error) { return UnpackBatchUpdated(t, d) },
	TopicBatchedTroveUpdated:              func(t []common.Hash, d []byte) (any, error) { return UnpackBatchedTroveUpdated(t, d) },
	TopicBoldTokenAddressChanged:          func(t []common.Hash, d []byte) (any, error) { return UnpackBoldTokenAddressChanged(t, d) },
	TopicBorrowerOperationsAddressAdded:   func(t []common.Hash, d []byte) (any, error) { return UnpackBorrowerOperationsAddressAdded(t, d) },
	TopicBorrowerOperationsAddressChanged: func(t []common.Hash, d []byte) (any, error) { return UnpackBorrowerOperationsAddressChanged(t, d) },
	TopicCollBalanceUpdated:               func(t []common.Hash, d []byte) (any, error) { return UnpackCollBalanceUpdated(t, d) },
	TopicCollSent:                         func(t []common.Hash, d []byte) (any, error) { return UnpackCollSent(t, d) },
	TopicCollSurplusPoolAddressChanged:    func(t []common.Hash, d []byte) (any, error) { return UnpackCollSurplusPoolAddressChanged(t, d) },
	TopicCollTokenAddressChanged:          func(t []common.Hash, d []byte) (any, error) { return UnpackCollTokenAddressChanged(t, d) },
	TopicCollateralRegistryAddressChanged: func(t []common.Hash, d []byte) (any, error) { return UnpackCollateralRegistryAddressChanged(t, d) },
	TopicDefaultPoolAddressChanged:        func(t []common.Hash, d []byte) (any, error) { return UnpackDefaultPoolAddressChanged(t, d) },
	TopicDefaultPoolBoldDebtUpdated:       func(t []common.Hash, d []byte) (any, error) { return UnpackDefaultPoolBoldDebtUpdated(t, d) },
	TopicDefaultPoolCollBalanceUpdated:    func(t []common.Hash, d []byte) (any, error) { return UnpackDefaultPoolCollBalanceUpdated(t, d) },
	TopicDepositOperation:                 func(t []common.Hash, d []byte) (any, error) { return UnpackDepositOperation(t, d) },
	TopicDepositUpdated:                   func(t []common.Hash, d []byte) (any, error) { return UnpackDepositUpdated(t, d) },
	TopicGasPoolAddressChanged:            func(t []common.Hash, d []byte) (any, error) { return UnpackGasPoolAddressChanged(t, d) },
	TopicHintHelpersAddressChanged:        func(t []common.Hash, d []byte) (any, error) { return UnpackHintHelpersAddressChanged(t, d) },
	TopicInterestRouterAddressChanged:     func(t []common.Hash, d []byte) (any, error) { return UnpackInterestRouterAddressChanged(t, d) },
	TopicLastGoodPriceUpdated:             func(t []common.Hash, d []byte) (any, error) { return UnpackLastGoodPriceUpdated(t, d) },
	TopicLastFeeOpTimeUpdated:             func(t []common.Hash, d []byte) (any, error) { return UnpackLastFeeOpTimeUpdated(t, d) },
	TopicLiquidation:                      func(t []common.Hash, d []byte) (any, error) { return UnpackLiquidation(t, d) },
	TopicMetadataNFTAddressChanged:        func(t []common.Hash, d []byte) (any, error) { return UnpackMetadataNFTAddressChanged(t, d) },
	TopicMultiTroveGetterAddressChanged:   func(t []common.Hash, d []byte) (any, error) { return UnpackMultiTroveGetterAddressChanged(t, d) },
	TopicOwnershipTransferred:             func(t []common.Hash, d []byte) (any, error) { return UnpackOwnershipTransferred(t, d) },
	TopicPUpdated:                         func(t []common.Hash, d []byte) (any, error) { return UnpackPUpdated(t, d) },
	TopicPriceFeedAddressChanged:          func(t []common.Hash, d []byte) (any, error) { return UnpackPriceFeedAddressChanged(t, d) },
	TopicRedemption:                       func(t []common.Hash, d []byte) (any, error) { return UnpackRedemption(t, d) },
	TopicRedemptionFeePaidToTrove:         func(t []common.Hash, d []byte) (any, error) { return UnpackRedemptionFeePaidToTrove(t, d) },
	TopicRemoveManagerAndReceiverUpdated:  func(t []common.Hash, d []byte) (any, error) { return UnpackRemoveManagerAndReceiverUpdated(t, d) },
	TopicSUpdated:                         func(t []common.Hash, d []byte) (any, error) { return UnpackSUpdated(t, d) },
	TopicScaleUpdated:                     func(t []common.Hash, d []byte) (any, error) { return UnpackScaleUpdated(t, d) },
	TopicShutDownFromOracleFailure:        func(t []common.Hash, d []byte) (any, error) { return UnpackShutDownFromOracleFailure(t, d) },
	TopicSortedTrovesAddressChanged:       func(t []common.Hash, d []byte) (any, error) { return UnpackSortedTrovesAddressChanged(t, d) },
	TopicStabilityPoolAddressAdded:        func(t []common.Hash, d []byte) (any, error) { return UnpackStabilityPoolAddressAdded(t, d) },
	TopicStabilityPoolAddressChanged:      func(t []common.Hash, d []byte) (any, error) { return UnpackStabilityPoolAddressChanged(t, d) },
	TopicStabilityPoolBoldBalanceUpdated:  func(t []common.Hash, d []byte) (any, error) { return UnpackStabilityPoolBoldBalanceUpdated(t, d) },
	TopicStabilityPoolCollBalanceUpdated:  func(t []common.Hash, d []byte) (any, error) { return UnpackStabilityPoolCollBalanceUpdated(t, d) },
	TopicTroveManagerAddressAdded:         func(t []common.Hash, d []byte) (any, error) { return UnpackTroveManagerAddressAdded(t, d) },
	TopicTroveManagerAddressChanged:       func(t []common.Hash, d []byte) (any, error) { return UnpackTroveManagerAddressChanged(t, d) },
	TopicTroveNFTAddressChanged:           func(t []common.Hash, d []byte) (any, error) { return UnpackTroveNFTAddressChanged(t, d) },
	TopicTroveOperation:                   func(t []common.Hash, d []byte) (any, error) { return UnpackTroveOperation(t, d) },
	TopicTroveUpdated:                     func(t []common.Hash, d []byte) (any, error) { return UnpackTroveUpdated(t, d) },
	TopicWETHAddressChanged:               func(t []common.Hash, d []byte) (any, error) { return UnpackWETHAddressChanged(t, d) },
}

// UnpackLog decodes a Liquity log into the database event type matching its signature.
// ERC-20 and ERC-721 Approval/Transfer signatures are distinguished by topic count.
func UnpackLog(log gethTypes.Log) (any, error) {
	if ErrABI != nil {
		return nil, ErrABI
	}
	if len(log.Topics) == 0 {
		return nil, errors.New("liquity event has no topics")
	}
	switch log.Topics[0] {
	case TopicBoldTokenApproval:
		if len(log.Topics) == 4 {
			return UnpackTroveNFTApproval(log.Topics, log.Data)
		}
		return UnpackBoldTokenApproval(log.Topics, log.Data)
	case TopicBoldTokenTransfer:
		if len(log.Topics) == 4 {
			return UnpackTroveNFTTransfer(log.Topics, log.Data)
		}
		return UnpackBoldTokenTransfer(log.Topics, log.Data)
	case TopicTroveNFTApprovalForAll:
		return UnpackTroveNFTApprovalForAll(log.Topics, log.Data)
	}
	decode, ok := decoders[log.Topics[0]]
	if !ok {
		return nil, fmt.Errorf("unknown Liquity event topic %s", log.Topics[0])
	}
	return decode(log.Topics, log.Data)
}
